import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import { computeCloAttainment } from "../src/lib/cloAttainment";
import { scoringSignature, toDraft, finalizeCriteria } from "../src/components/RubricCriteriaEditor";

const BASE = "http://localhost:3000";

// 11/10/2569 — a rubric criterion can be tagged with the course's CLOs; the teacher sees the tags on the rubric,
// and the CLO page shows which criteria measure each CLO and how the class did on them (CLO attainment).
//
// Seed, worked out by hand. Rubric as1: k1 "Layout" /10 → CLO1, k2 "Accessibility" /10 → CLO1 + CLO2, k3 "Notes" /5 → no CLO.
//   Ann  k1 10  k2 6   graded
//   Ben  k1 8   k2 6   graded
//   Cat  (handed in, not graded)
//   Dan  k1 0   k2 0   graded but WITHDRAWN — must not count
//   CLO1 = (10+8) + (6+6) = 30 of 40 = 75%   (Layout avg 90%, Accessibility avg 60%)
//   CLO2 = 12 of 20 = 60%
//   CLO3 = measured by nothing

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69071101", "Ann", "enrolled"], ["69071102", "Ben", "enrolled"], ["69071103", "Cat", "enrolled"], ["69071104", "Dan", "withdrawn"]];
const SCORES: Record<string, [number, number]> = { "69071101": [10, 6], "69071102": [8, 6], "69071104": [0, 0] };
const levels = [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }];
const CLOS = [
  { id: "clo1", courseId: "c-clo", code: "CLO1", text: "Build a working page", createdAt: NOW, updatedAt: NOW },
  { id: "clo2", courseId: "c-clo", code: "CLO2", text: "Make it accessible", createdAt: NOW, updatedAt: NOW },
  { id: "clo3", courseId: "c-clo", code: "CLO3", text: "Work in a team", createdAt: NOW, updatedAt: NOW },
];
const RUBRIC = {
  id: "r1", assignmentId: "as1", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [
    { id: "k1", name: "Layout", description: "", maxPoints: 10, weight: 40, levels, cloIds: ["clo1"] },
    { id: "k2", name: "Accessibility", description: "", maxPoints: 10, weight: 40, levels, cloIds: ["clo1", "clo2"] },
    { id: "k3", name: "Notes", description: "", maxPoints: 5, weight: 20, levels },
  ],
};

async function seed(page: Page, o: { clos?: boolean; lang?: "en" | "th"; finalized?: boolean } = {}) {
  await page.addInitScript(([people, scores, rubric, clos, lang, finalized]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as string[][];
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-clo", name: "CLO Course", description: "", status: "active", coverColor: "#2DD4BF", courseTemplateId: "ct-clo", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076777", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t1", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-clo"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f, st], i) => ({ id: `r-${i}`, courseId: "c-clo", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: st }))));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_clos_v1", JSON.stringify(clos ? clos : []));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([
      { id: "as1", courseId: "c-clo", name: "Landing page", description: "", dueDate: "2026-01-10", maxPoints: 25, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r1"], gradingFinalized: finalized || undefined, createdAt: NOW, updatedAt: NOW },
      { id: "as2", courseId: "c-clo", name: "Midterm", description: "", maxPoints: 50, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: true, createdAt: NOW, updatedAt: NOW },
    ]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([rubric]));
    const sc = scores as Record<string, number[]>;
    const subs = ppl.map(([id, f]) => {
      const s = sc[id];
      const base = { id: `sub-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} Test`, email: `${id}@kmitl.ac.th`, submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, externalUseConsent: false, instructorComment: "", updatedAt: NOW };
      return s
        ? { ...base, aiScore: s[0] + s[1], instructorScore: s[0] + s[1], status: "graded", criterionScores: { k1: s[0], k2: s[1] } }
        : { ...base, aiScore: null, instructorScore: null, status: "not_graded" };
    });
    // an exam score has no per-criterion breakdown — it must add nothing to any CLO
    subs.push({ id: "sub-exam", assignmentId: "as2", studentId: "69071101", studentName: "Ann Test", email: "x", submittedAt: NOW, fileUrl: null, externalUseConsent: false, instructorComment: "", updatedAt: NOW, aiScore: null, instructorScore: 45, status: "graded" } as never);
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
  }, [PEOPLE, SCORES, RUBRIC, o.clos === false ? null : CLOS, o.lang ?? "en", !!o.finalized] as const);
}

const C = `${BASE}/teacher/courses/c-clo`;
const rubricOnDisk = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]")[0] as { criteria: { id: string; cloIds?: string[]; maxPoints: number }[] }));
const subsOnDisk = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { status: string }[]);

// ── the calculation ──────────────────────────────────────────────────────────────

test.describe("computeCloAttainment", () => {
  const assignments = [{ id: "as1", name: "Landing page" }] as never;
  const sub = (id: string, k: [number, number], status = "graded") => ({ id, assignmentId: "as1", status, criterionScores: { k1: k[0], k2: k[1] } }) as never;

  test("points earned over points available across every criterion that measures the CLO", () => {
    const r = computeCloAttainment({ clos: CLOS as never, assignments, rubrics: [RUBRIC] as never, submissions: [sub("a", [10, 6]), sub("b", [8, 6])] });
    expect(r[0].pct).toBeCloseTo(75);   // 30 of 40
    expect(r[1].pct).toBeCloseTo(60);   // 12 of 20
    expect(r[0].links.map((l) => [l.criterionName, Math.round(l.pct!)])).toEqual([["Layout", 90], ["Accessibility", 60]]);
    expect(r[0].gradedCount).toBe(2);
  });

  test("a criterion with more points counts for more (it is not an average of percentages)", () => {
    const rubric = { ...RUBRIC, criteria: [
      { id: "k1", name: "Big", maxPoints: 18, weight: 90, levels, cloIds: ["clo1"] },
      { id: "k2", name: "Small", maxPoints: 2, weight: 10, levels, cloIds: ["clo1"] },
    ] };
    const r = computeCloAttainment({ clos: [CLOS[0]] as never, assignments, rubrics: [rubric] as never, submissions: [sub("a", [18, 0])] });
    expect(r[0].pct).toBeCloseTo(90);   // 18 of 20; the plain average of 100% and 0% would say 50%
  });

  test("not graded, or graded without a per-criterion breakdown, adds nothing; an unlinked CLO has no figure", () => {
    const none = computeCloAttainment({ clos: CLOS as never, assignments, rubrics: [RUBRIC] as never, submissions: [sub("a", [10, 10], "not_graded"), { id: "x", assignmentId: "as1", status: "graded" } as never] });
    expect(none[0].pct).toBeNull();
    expect(none[0].links).toHaveLength(2);   // still listed as measuring it
    expect(none[2].links).toEqual([]);       // CLO3: nothing measures it
    expect(none[2].pct).toBeNull();
  });

  test("a deleted CLO id on a criterion is simply ignored", () => {
    const rubric = { ...RUBRIC, criteria: [{ ...RUBRIC.criteria[0], cloIds: ["gone"] }] };
    const r = computeCloAttainment({ clos: CLOS as never, assignments, rubrics: [rubric] as never, submissions: [sub("a", [10, 10])] });
    expect(r.every((x) => x.links.length === 0)).toBe(true);
  });
});

test.describe("editor helpers", () => {
  test("tags survive the round trip between a saved criterion and its draft; none is omitted entirely", () => {
    const drafts = RUBRIC.criteria.map((c) => toDraft(c as never));
    expect(drafts.map((d) => d.cloIds)).toEqual([["clo1"], ["clo1", "clo2"], []]);
    const saved = finalizeCriteria(drafts, "Untitled");
    expect(saved.map((c) => c.cloIds)).toEqual([["clo1"], ["clo1", "clo2"], undefined]);
  });

  test("the scoring signature ignores CLO tags but sees everything else", () => {
    const drafts = RUBRIC.criteria.map((c) => toDraft(c as never));
    const retagged = drafts.map((d) => ({ ...d, cloIds: ["clo3"] }));
    expect(scoringSignature(retagged)).toBe(scoringSignature(drafts));
    expect(scoringSignature(drafts.map((d, i) => (i === 0 ? { ...d, points: "11" } : d)))).not.toBe(scoringSignature(drafts));
    expect(scoringSignature(drafts.map((d, i) => (i === 0 ? { ...d, name: "Layout!" } : d)))).not.toBe(scoringSignature(drafts));
  });
});

// ── the mock data ────────────────────────────────────────────────────────────────

for (const dir of ["public/mock-data", "test-data"]) {
  for (const suffix of ["", "-en"]) {
    test(`${dir} flow mock${suffix}: every criterion tag is a real CLO of that course, and every CLO is measured`, () => {
      const f = JSON.parse(fs.readFileSync(`${dir}/student-flow-mockup${suffix}.json`, "utf8")) as {
        clos: { id: string; courseId: string }[];
        assignments: { id: string; courseId: string }[];
        rubrics: { assignmentId: string; criteria: { id: string; cloIds?: string[] }[] }[];
      };
      const bad: string[] = [];
      const measured = new Set<string>();
      for (const r of f.rubrics) {
        const course = f.assignments.find((a) => a.id === r.assignmentId)!.courseId;
        for (const c of r.criteria) for (const id of c.cloIds ?? []) {
          measured.add(id);
          const clo = f.clos.find((x) => x.id === id);
          if (!clo || clo.courseId !== course) bad.push(`${c.id}→${id}`);
        }
      }
      expect(bad).toEqual([]);
      expect(f.clos.filter((c) => !measured.has(c.id)).map((c) => c.id)).toEqual([]);
      expect(f.rubrics.flatMap((r) => r.criteria).filter((c) => (c.cloIds ?? []).length > 0).length).toBeGreaterThanOrEqual(15);
    });
  }
}

test("the English and Thai mock link the same criteria to the same CLOs", () => {
  const pick = (p: string) => (JSON.parse(fs.readFileSync(p, "utf8")) as { rubrics: { criteria: { id: string; cloIds?: string[] }[] }[] })
    .rubrics.flatMap((r) => r.criteria.map((c) => [c.id, c.cloIds ?? []]));
  expect(pick("public/mock-data/student-flow-mockup-en.json")).toEqual(pick("public/mock-data/student-flow-mockup.json"));
  expect(pick("test-data/student-flow-mockup.json")).toEqual(pick("public/mock-data/student-flow-mockup.json"));
});

// ── Edit Assignment: tagging ────────────────────────────────────────────────────

test.describe("Edit Assignment — the CLO row on each criterion", () => {
  test("each criterion offers the course's CLOs, the saved ones are pressed, and the chosen CLO's text is shown", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    const row = (i: number) => page.getByTestId(`clo-row-${i}`);
    await expect(row(0).getByRole("button")).toHaveText(["CLO1", "CLO2", "CLO3"]);
    await expect(row(0).getByRole("button", { name: "CLO1" })).toHaveAttribute("aria-pressed", "true");
    await expect(row(0).getByRole("button", { name: "CLO2" })).toHaveAttribute("aria-pressed", "false");
    await expect(row(1).getByRole("button", { name: "CLO2" })).toHaveAttribute("aria-pressed", "true");
    await expect(row(0)).toContainText("Build a working page");
    await expect(row(2).getByRole("button", { pressed: true })).toHaveCount(0);
  });

  test("ticking and unticking CLOs saves them on the criterion", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("clo-row-2").getByRole("button", { name: "CLO3" }).click();      // Notes → CLO3
    await page.getByTestId("clo-row-1").getByRole("button", { name: "CLO1" }).click();      // Accessibility: drop CLO1, keep CLO2
    await expect(page.getByTestId("clo-row-2").getByRole("button", { name: "CLO3" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    const r = await rubricOnDisk(page);
    expect(r.criteria.map((c) => c.cloIds ?? [])).toEqual([["clo1"], ["clo2"], ["clo3"]]);
  });

  test("re-tagging CLOs on graded work saves straight away — no 'restart grading' popup, no scores cleared", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("clo-row-2").getByRole("button", { name: "CLO3" }).click();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await subsOnDisk(page)).filter((s) => s.status === "graded").length).toBeGreaterThanOrEqual(3);
    // …while changing a number still warns
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Points").first().fill("12");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("dialog", { name: "Changing the rubric restarts grading" })).toBeVisible();
  });

  test("a course with no CLOs says so, with a link to the CLO tab", async ({ page }) => {
    await seed(page, { clos: false });
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    const row = page.getByTestId("clo-row-0");
    await expect(row).toContainText("This course has no CLOs yet");
    await expect(row.getByRole("link", { name: "add them on the CLO tab" })).toHaveAttribute("href", "/teacher/courses/c-clo/clo");
    await expect(row.getByRole("button")).toHaveCount(0);
  });

  test("an announced assignment keeps its CLO tags locked along with the rest of the rubric", async ({ page }) => {
    await seed(page, { finalized: true });
    await page.goto(`${C}/assignments/as1/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("clo-row-0").getByRole("button", { name: "CLO1" })).toBeDisabled();
  });

  test("New Assignment offers the course's CLOs too, and a ticked one is kept in the saved rubric", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("Report");
    await page.locator('input[type="date"]').fill("2099-12-31");
    await page.getByTestId("clo-row-0").getByRole("button", { name: "CLO2" }).click();
    await page.getByTestId("clo-row-0").getByRole("button", { name: "CLO3" }).click();
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect.poll(async () => (await page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as unknown[]).length))).toBe(2);
    const added = await page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_rubrics_v1") ?? "[]") as { id: string; criteria: { cloIds?: string[] }[] }[]).find((r) => r.id !== "r1"));
    expect(added!.criteria[0].cloIds).toEqual(["clo2", "clo3"]);
  });
});

// ── the tags where the teacher reads the rubric ────────────────────────────────────

test("the assignment page tags each criterion with its CLOs; an untagged criterion has none", async ({ page }) => {
  await seed(page);
  await page.goto(`${C}/assignments/as1`);
  await page.waitForLoadState("networkidle");
  const card = (name: string) => page.locator("div.rounded-xl", { has: page.getByText(name, { exact: true }) }).first();
  await expect(card("Layout").getByTestId("clo-chips")).toHaveText("CLO1");
  await expect(card("Accessibility").getByTestId("clo-chips")).toHaveText("CLO1CLO2");
  await expect(card("Notes").getByTestId("clo-chips")).toHaveCount(0);
});

test("the Grading page's rubric card shows the same tags", async ({ page }) => {
  await seed(page);
  await page.goto(`${C}/assignments/as1/grading`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("rubric-row-k2").getByTestId("clo-chips")).toHaveText("CLO1CLO2");
  await expect(page.getByTestId("rubric-row-k3").getByTestId("clo-chips")).toHaveCount(0);
});

// ── the CLO page ────────────────────────────────────────────────────────────────────

test.describe("CLO page", () => {
  test("the 'linking isn't available yet' note is gone", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/isn't available yet/)).toHaveCount(0);
    await expect(page.getByText(/planned for a future release/)).toHaveCount(0);
  });

  test("each CLO lists the criteria that measure it with how the class did, and its attainment — withdrawn students and exams left out", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    const clo1 = page.getByTestId("clo-links-CLO1");
    await expect(clo1.getByTestId("clo-attainment")).toHaveText("75%");
    await expect(clo1).toContainText("from 2 graded submissions · 2 criteria");
    await expect(clo1.getByRole("listitem")).toHaveCount(2);
    await expect(clo1.getByRole("listitem").nth(0)).toContainText("Landing page · Layout");
    await expect(clo1.getByRole("listitem").nth(0)).toContainText("10 pts");
    await expect(clo1.getByRole("listitem").nth(0)).toContainText("90%");
    await expect(clo1.getByRole("listitem").nth(1)).toContainText("Accessibility");
    await expect(clo1.getByRole("listitem").nth(1)).toContainText("60%");
    await expect(clo1.getByRole("link", { name: "Landing page" }).first()).toHaveAttribute("href", "/teacher/courses/c-clo/assignments/as1");

    const clo2 = page.getByTestId("clo-links-CLO2");
    await expect(clo2.getByTestId("clo-attainment")).toHaveText("60%");
    await expect(clo2.getByRole("listitem")).toHaveCount(1);
  });

  test("a CLO nothing measures says so, instead of showing a number", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    const clo3 = page.getByTestId("clo-links-CLO3");
    await expect(clo3.getByTestId("clo-unmeasured")).toContainText("No criterion measures this CLO yet");
    await expect(clo3.getByTestId("clo-attainment")).toHaveCount(0);
  });

  test("linked but nothing graded yet: the criteria are listed and the figure says nothing is graded", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => localStorage.setItem("hwai_submissions_v1", "[]"));
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    const clo2 = page.getByTestId("clo-links-CLO2");
    await expect(clo2).toContainText("Nothing graded yet");
    await expect(clo2.getByRole("listitem")).toHaveCount(1);
    await expect(clo2.getByTestId("clo-attainment")).toHaveCount(0);
  });

  test("a CLO's tone follows the same colours as the Score Book (80+ green, 60–79 blue, below 60 red)", async ({ page }) => {
    await seed(page);
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    const tone = (code: string) => page.getByTestId(`clo-links-${code}`).getByTestId("clo-attainment").evaluate((el) => el.className);
    expect(await tone("CLO1")).toContain("s-info");   // 75%
    expect(await tone("CLO2")).toContain("s-info");   // 60%
  });

  test("Thai UI", async ({ page }) => {
    await seed(page, { lang: "th" });
    await page.goto(`${C}/clo`);
    await page.waitForLoadState("networkidle");
    const clo1 = page.getByTestId("clo-links-CLO1");
    await expect(clo1).toContainText("ผลลัพธ์ CLO ของห้อง");
    await expect(clo1).toContainText("จากงานที่ตรวจแล้ว 2 ชิ้น · 2 เกณฑ์");
    await expect(page.getByTestId("clo-links-CLO3")).toContainText("ยังไม่มีเกณฑ์ใดวัด CLO นี้");
  });
});
