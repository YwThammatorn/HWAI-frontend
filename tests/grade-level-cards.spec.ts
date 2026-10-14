import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";

// 14/10/2569: the Grade screen marks each rubric criterion by clicking a level card (the same cards as the Calibration tab)
// instead of typing a number. Rubric: C1 /9 and C2 /3, four levels each → C1 9 / 6 / 3 / 0, C2 3 / 2 / 1 / 0 (levels are positions, 0 = best).

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-glc", name: "Programming", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-glc", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-glc", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-glc"] };
const lv = (label: string) => ({ label, description: `${label} wording` });
const LEVELS = [lv("Excellent"), lv("Fair"), lv("Needs work"), lv("Fail")];
const ASSIGNMENT = {
  id: "a-glc", courseId: "c-glc", name: "Exercise", description: "", dueDate: "2099-12-31", maxPoints: 12, submissionType: "individual",
  maxGroupSize: null, acceptsFiles: true, fileTypes: [], rubricIds: ["r-glc"], createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = {
  id: "r-glc", assignmentId: "a-glc", name: "Exercise rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "c1", name: "C1 · Correctness / ความถูกต้อง", description: "", maxPoints: 9, weight: 75, levels: LEVELS },
    { id: "c2", name: "C2 · Style / รูปแบบ", description: "", maxPoints: 3, weight: 25, levels: LEVELS },
  ],
};
const sub = (id: string, extra: Record<string, unknown>) => ({
  id, assignmentId: "a-glc", studentId: id, studentName: `Student ${id}`, email: `${id}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: null, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "not_graded", updatedAt: "2026-01-05T10:00:00.000Z", ...extra,
});
const SUBS = [
  // the AI scored it through the rubric: C1 level 2 (6 pts), C2 level 1 (3 pts)
  sub("ai-levels", { aiScore: 9, aiCriterionScores: { c1: 6, c2: 3 }, status: "need_review" }),
  // only an overall AI score: its shares are 8 and 3 (no level of C1 is worth 8)
  sub("ai-total", { aiScore: 10, status: "need_review" }),
  // nothing from the AI
  sub("blank", {}),
];

async function open(page: Page, subId: string, opts: { manual?: boolean; lang?: "en" | "th" } = {}) {
  await page.addInitScript(([d]) => {
    if (sessionStorage.getItem("glc_seeded")) return;   // addInitScript re-runs on every navigation
    sessionStorage.setItem("glc_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([d.rubric]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
  }, [{ course: COURSE, teacher: TEACHER, assignment: { ...ASSIGNMENT, ...(opts.manual ? { gradingMode: "manual" } : {}) }, rubric: RUBRIC, subs: SUBS, lang: opts.lang ?? "en" }] as const);
  await page.goto(`${BASE}/teacher/courses/c-glc/assignments/a-glc/recheck?sub=${subId}`);
  await page.waitForLoadState("networkidle");
}

const group = (page: Page, criterion: string) => page.getByRole("radiogroup", { name: `Level for ${criterion}` });
const level = (page: Page, criterion: string, label: string) => group(page, criterion).getByRole("radio", { name: new RegExp(`^${label}`) });
const total = (page: Page) => page.locator("div", { has: page.getByText("Total Score", { exact: true }) }).last();
type Stored = { criterionScores: Record<string, number>; instructorScore: number; status: string };
const stored = (page: Page, id: string) => page.evaluate((sid) => (JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as (Stored & { id: string })[]).find((s) => s.id === sid)!, id);

test("each criterion shows its levels as cards worth their points; no number box", async ({ page }) => {
  await open(page, "ai-levels");
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await expect(group(page, "Correctness").getByRole("radio")).toHaveText([/Excellent · 9/, /Fair · 6/, /Needs work · 3/, /Fail · 0/]);
  await expect(group(page, "Style").getByRole("radio")).toHaveText([/Excellent · 3/, /Fair · 2/, /Needs work · 1/, /Fail · 0/]);
  await expect(level(page, "Correctness", "Fair")).toContainText("Fair wording");
});

test("work the AI scored through the rubric starts on the AI's level, tagged AI", async ({ page }) => {
  await open(page, "ai-levels");
  await expect(level(page, "Correctness", "Fair")).toHaveAttribute("aria-checked", "true");   // 6
  await expect(level(page, "Style", "Excellent")).toHaveAttribute("aria-checked", "true");     // 3
  await expect(page.getByTestId("mark-ai-c1")).toBeVisible();
  await expect(level(page, "Correctness", "Fair").getByTestId("mark-ai-c1")).toBeVisible();
  await expect(total(page)).toContainText("9 / 12");
  await expect(page.getByTestId("grade-unmarked")).toHaveCount(0);
  await expect(page.getByText("Manually Edited")).toHaveCount(0);
});

test("clicking a level changes that criterion's points and the total, marks it edited, and keeps the AI tag where the AI put it", async ({ page }) => {
  await open(page, "ai-levels");
  await level(page, "Correctness", "Excellent").click();
  await expect(level(page, "Correctness", "Excellent")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "Correctness", "Fair")).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("crit-score-c1")).toContainText("9 / 9");
  await expect(total(page)).toContainText("12 / 12");
  await expect(page.getByText("Manually Edited")).toBeVisible();
  await expect(level(page, "Correctness", "Fair").getByTestId("mark-ai-c1")).toBeVisible();   // the AI's level stays tagged
  // choosing the AI's own level again is not an edit
  await level(page, "Correctness", "Fair").click();
  await expect(page.getByText("Manually Edited")).toHaveCount(0);
});

test("Save stores the level points per criterion, and Reset to Default goes back to the AI's levels", async ({ page }) => {
  await open(page, "ai-levels");
  await level(page, "Correctness", "Needs work").click();   // 3
  await level(page, "Style", "Fair").click();               // 2
  await expect(total(page)).toContainText("5 / 12");
  await page.getByRole("button", { name: /reset to default/i }).click();
  await expect(level(page, "Correctness", "Fair")).toHaveAttribute("aria-checked", "true");
  await level(page, "Correctness", "Needs work").click();
  await page.getByRole("button", { name: /save changes/i }).click();
  const s = (await stored(page, "ai-levels")) as { criterionScores: Record<string, number>; instructorScore: number; status: string };
  expect(s.criterionScores).toEqual({ c1: 3, c2: 3 });
  expect(s.instructorScore).toBe(6);
  expect(s.status).toBe("graded");
});

test("an earlier score that sits on no level is shown as it was, nothing is highlighted, and it is kept until a level is clicked", async ({ page }) => {
  await open(page, "ai-total");
  // round(0.75 × 10) = 8 of 9 and round(0.25 × 10) = 3 of 3 (the second is the top level)
  await expect(page.getByTestId("crit-offlevel-c1")).toContainText("Earlier score 8 / 9");
  await expect(group(page, "Correctness").getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByTestId("crit-offlevel-c2")).toHaveCount(0);
  await expect(level(page, "Style", "Excellent")).toHaveAttribute("aria-checked", "true");
  await expect(total(page)).toContainText("11 / 12");
  await page.getByRole("button", { name: /save changes/i }).click();
  const s = (await stored(page, "ai-total")) as { criterionScores: Record<string, number>; instructorScore: number };
  expect(s.criterionScores).toEqual({ c1: 8, c2: 3 });   // untouched
  expect(s.instructorScore).toBe(11);
});

test("clicking a level on an off-level criterion replaces the old score", async ({ page }) => {
  await open(page, "ai-total");
  await level(page, "Correctness", "Excellent").click();
  await expect(page.getByTestId("crit-offlevel-c1")).toHaveCount(0);
  await expect(total(page)).toContainText("12 / 12");
});

test("hand-graded work starts empty, saving waits until every criterion is marked, then stores the level points", async ({ page }) => {
  await open(page, "blank", { manual: true });
  await expect(page.getByText("Graded by hand — no AI on this assignment")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByTestId("mark-ai-c1")).toHaveCount(0);
  const save = page.getByRole("button", { name: /save changes/i });
  await expect(save).toBeDisabled();
  await expect(page.getByTestId("grade-unmarked")).toHaveText("Pick a level for 2 more criteria before saving");
  await level(page, "Correctness", "Fair").click();
  await expect(page.getByTestId("grade-unmarked")).toHaveText("Pick a level for 1 more criterion before saving");
  await expect(save).toBeDisabled();
  await level(page, "Style", "Fair").click();
  await expect(page.getByTestId("grade-unmarked")).toHaveCount(0);
  await expect(save).toBeEnabled();
  await expect(total(page)).toContainText("8 / 12");
  await save.click();
  const s = (await stored(page, "blank")) as { criterionScores: Record<string, number>; instructorScore: number; status: string };
  expect(s.criterionScores).toEqual({ c1: 6, c2: 2 });
  expect(s.instructorScore).toBe(8);
  expect(s.status).toBe("graded");
});

test("reopening graded work shows the teacher's saved levels, not the AI's", async ({ page }) => {
  await open(page, "ai-levels");
  await level(page, "Correctness", "Fail").click();
  await level(page, "Style", "Fail").click();
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect.poll(async () => ((await stored(page, "ai-levels")) as { status: string }).status).toBe("graded");
  await page.goto(`${BASE}/teacher/courses/c-glc/assignments/a-glc/recheck?sub=ai-levels`);
  await page.waitForLoadState("networkidle");
  await expect(level(page, "Correctness", "Fail")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "Style", "Fail")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "Correctness", "Fair").getByTestId("mark-ai-c1")).toBeVisible();   // the AI's level is still shown for comparison
});

test("Thai UI", async ({ page }) => {
  await open(page, "blank", { manual: true, lang: "th" });
  await expect(page.getByRole("radiogroup", { name: "ระดับของ Correctness" })).toBeVisible();
  await expect(page.getByTestId("grade-unmarked")).toHaveText("เลือกระดับอีก 2 เกณฑ์ก่อนบันทึก");
});
