import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// 14/10/2569 — every criterion of a rubric uses the SAME number of levels. The header control adds / removes a level on all of them
// (covered in teacher-batch-3.spec.ts); here: old data that still mixes counts is flagged, can be evened out ("let the AI fit them"),
// cannot be saved until it is, and a criterion added later follows the rubric's count. The picker's warning is in rubric-picker.spec.ts.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-lvl", name: "Web Design", description: "", status: "active",
  coverColor: "#2DD4BF", courseTemplateId: "ct-lvl", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076099", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};
const lv = (...labels: string[]) => labels.map((label) => ({ label, description: `${label} wording` }));
const ASSIGNMENT = {
  id: "a-lvl", courseId: "c-lvl", name: "Landing page", description: "", dueDate: "2099-12-31", maxPoints: 100,
  acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual" as const, maxGroupSize: null, rubricIds: ["r-lvl"], isExam: false,
  createdAt: NOW, updatedAt: NOW,
};
// an old rubric: one criterion with 5 levels, two with 3
const rubric = (levels: Record<string, ReturnType<typeof lv>>) => ({
  id: "r-lvl", assignmentId: "a-lvl", name: "Grading Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "k1", name: "Layout", description: "", maxPoints: 40, weight: 40, levels: levels.k1 },
    { id: "k2", name: "Accessibility", description: "", maxPoints: 30, weight: 30, levels: levels.k2 },
    { id: "k3", name: "Content", description: "", maxPoints: 30, weight: 30, levels: levels.k3 },
  ],
});
const MIXED = rubric({ k1: lv("ดีเยี่ยม", "ดี", "พอใช้", "ต้องปรับปรุง", "ไม่ผ่าน"), k2: lv("ดีเยี่ยม", "ดี", "ไม่ผ่าน"), k3: lv("ดีเยี่ยม", "พอใช้", "ไม่ผ่าน") });
const UNIFORM = rubric({ k1: lv("ดีเยี่ยม", "ดี", "ไม่ผ่าน"), k2: lv("ดีเยี่ยม", "ดี", "ไม่ผ่าน"), k3: lv("ดีเยี่ยม", "ดี", "ไม่ผ่าน") });

async function open(page: Page, r: ReturnType<typeof rubric>) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("lvl_seeded")) return;
    sessionStorage.setItem("lvl_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([d.rubric]));
  }, { course: COURSE, assignment: ASSIGNMENT, rubric: r });
  await page.goto(`${BASE}/teacher/courses/c-lvl/assignments/a-lvl/edit`);
  await page.waitForLoadState("networkidle");
}
const counts = (page: Page) => page.locator("div.rounded-2xl", { has: page.getByLabel("Criterion name") }).evaluateAll((cards) => cards.filter((c) => !c.querySelector("div.rounded-2xl")).map((c) => c.querySelectorAll("input[aria-label='Level name']").length));
const saved = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as { criteria: { levels: { label: string; description: string }[] }[] }[])[0].criteria.map((c) => c.levels));

test("a uniform rubric shows its one level count, no warning, and saves", async ({ page }) => {
  await open(page, UNIFORM);
  await expect(page.getByTestId("level-count")).toHaveText("3 levels");
  await expect(page.getByTestId("levels-mixed")).toHaveCount(0);
  await expect(page.getByTestId("level-scale")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeEnabled();
});

test("old data with different counts is flagged, cannot be saved, and 'let the AI even them out' fits every criterion to the usual count", async ({ page }) => {
  await open(page, MIXED);
  await expect(page.getByTestId("levels-mixed")).toContainText("3 / 5");
  await expect(page.getByTestId("level-scale")).toHaveCount(0);            // the level → points caption only makes sense once they agree
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await expect(page.getByText("Every criterion needs the same number of levels before you can save")).toBeVisible();

  await page.getByTestId("levels-mixed").getByRole("button", { name: /even them out to 3 levels/ }).click();
  await expect(page.getByTestId("levels-mixed")).toHaveCount(0);
  expect(await counts(page)).toEqual([3, 3, 3]);
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeEnabled();

  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  const levels = await saved(page);
  expect(levels.map((l) => l.length)).toEqual([3, 3, 3]);
  // shrinking 5 → 3 keeps the best and the worst, and the middle one it keeps is a real level of the old scale (spread evenly: positions 0, 2, 4)
  expect(levels[0].map((l) => l.label)).toEqual(["ดีเยี่ยม", "พอใช้", "ไม่ผ่าน"]);
  expect(levels[0].map((l) => l.description)).toEqual(["ดีเยี่ยม wording", "พอใช้ wording", "ไม่ผ่าน wording"]);
  expect(levels[1].map((l) => l.label)).toEqual(["ดีเยี่ยม", "ดี", "ไม่ผ่าน"]);   // already 3: untouched
});

test("the most common count wins, and a shorter criterion grows with wording of its own for the new level", async ({ page }) => {
  await open(page, rubric({ k1: lv("ดีเยี่ยม", "ดี", "พอใช้", "ไม่ผ่าน"), k2: lv("ดีเยี่ยม", "ดี", "พอใช้", "ไม่ผ่าน"), k3: lv("ดีเยี่ยม", "ไม่ผ่าน") }));
  await expect(page.getByTestId("levels-mixed")).toContainText("2 / 4");
  await page.getByTestId("levels-mixed").getByRole("button", { name: /even them out to 4 levels/ }).click();
  expect(await counts(page)).toEqual([4, 4, 4]);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  const grown = (await saved(page))[2];
  expect(grown).toHaveLength(4);
  expect([grown[0].label, grown[3].label]).toEqual(["ดีเยี่ยม", "ไม่ผ่าน"]);                    // best and worst untouched
  expect(grown[1].description.length).toBeGreaterThan(0);                                       // the two new levels were given wording…
  expect(grown[2].description.length).toBeGreaterThan(0);
  expect(grown[1].label).not.toBe(grown[2].label);                                              // …and names that differ from each other
});

test("a criterion added later follows the rubric's level count", async ({ page }) => {
  await open(page, UNIFORM);
  await page.getByTestId("level-control").getByRole("button", { name: "Add a level to every criterion" }).click();   // 4 levels
  await page.getByRole("button", { name: "Add New Criterion" }).click();
  expect(await counts(page)).toEqual([4, 4, 4, 4]);
  await expect(page.getByTestId("levels-mixed")).toHaveCount(0);
});

test("Thai UI", async ({ page }) => {
  await open(page, MIXED);
  await page.evaluate(() => localStorage.setItem("hwai_lang", "th"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("levels-mixed")).toContainText("เกณฑ์มีจำนวนระดับไม่เท่ากัน");
  await expect(page.getByTestId("levels-mixed").getByRole("button", { name: /ให้ AI ปรับให้เป็น 3 ระดับเท่ากัน/ })).toBeVisible();
});
