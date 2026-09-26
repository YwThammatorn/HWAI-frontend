import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";

// 26/9/2569 — a student looking at a graded assignment sees what each rubric criterion earned
// (56 / 60 with a bar), not only the total. Only real per-criterion scores are shown, never an estimate,
// and nothing appears until the teacher has announced the results.

const NOW = "2026-01-01T00:00:00.000Z";
const RUBRIC = {
  id: "r-1", assignmentId: "a-1", name: "R",
  criteria: [
    { id: "k1", name: "Correctness", description: "", maxPoints: 60, weight: 60, levels: [] },
    { id: "k2", name: "Clean code", description: "", maxPoints: 40, weight: 40, levels: [] },
  ],
};
const assignment = (finalized: boolean) => ({ id: "a-1", courseId: "c-rp", name: "Exercise", description: "", dueDate: "2026-01-05", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r-1"], gradingFinalized: finalized, createdAt: NOW });
const submission = (criterionScores?: Record<string, number>) => ({
  id: "s-1", assignmentId: "a-1", studentId: "69070401", studentName: "Ann S", email: "69070401@kmitl.ac.th", submittedAt: "2026-01-03T10:00:00.000Z",
  fileUrl: null, aiScore: 80, instructorScore: 90, instructorComment: "Nice", externalUseConsent: true, status: "graded", updatedAt: NOW,
  ...(criterionScores ? { criterionScores } : {}),
});

async function open(page: Page, opts: { finalized?: boolean; criterionScores?: Record<string, number>; lang?: "en" | "th" } = {}) {
  await page.addInitScript(([lang, a, sub]) => {
    if (sessionStorage.getItem("rp")) return;
    sessionStorage.setItem("rp", "1");
    localStorage.setItem("hwai_lang", lang as string);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-rp", name: "Python", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r1", courseId: "c-rp", studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([a]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([sub]));
  }, [opts.lang ?? "en", assignment(opts.finalized ?? true), submission(opts.criterionScores)] as const);
  await page.addInitScript((r) => { if (!localStorage.getItem("hwai_rubrics_v1")) localStorage.setItem("hwai_rubrics_v1", JSON.stringify([r])); }, RUBRIC);
  await page.goto(`${BASE}/student/courses/c-rp/classwork/a-1`);
  await page.waitForLoadState("networkidle");
}

test("each rubric criterion shows the points earned, with a bar", async ({ page }) => {
  await open(page, { criterionScores: { k1: 56, k2: 34 } });
  await expect(page.getByRole("heading", { name: "Grading Rubric — your points" })).toBeVisible();
  await expect(page.getByText("90", { exact: false }).first()).toBeVisible();
  const bar1 = page.getByRole("progressbar", { name: "Correctness: 56 of 60" });
  await expect(bar1).toHaveAttribute("aria-valuenow", "56");
  await expect(bar1).toHaveAttribute("aria-valuemax", "60");
  await expect(page.getByRole("progressbar", { name: "Clean code: 34 of 40" })).toBeVisible();
  // the earned points sit in the criterion card next to its name
  const card = page.locator("div.rounded-xl", { has: page.getByText("Correctness", { exact: true }) }).first();
  await expect(card).toContainText("56 / 60");
});

test("no per-criterion scores saved → the rubric stays the plain read-only one (no invented numbers)", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Grading Rubric", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("60% · 60 pts")).toBeVisible();
});

test("before the teacher announces results the points are not shown", async ({ page }) => {
  await open(page, { finalized: false, criterionScores: { k1: 56, k2: 34 } });
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("56 / 60")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Grading Rubric", exact: true })).toBeVisible();
});

test("Thai UI", async ({ page }) => {
  await open(page, { criterionScores: { k1: 56, k2: 34 }, lang: "th" });
  await expect(page.getByRole("heading", { name: "เกณฑ์การให้คะแนน — คะแนนที่คุณได้" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Correctness: ได้ 56 จาก 60" })).toBeVisible();
});

test("the Evaluation popup reads the saved scores (no 'estimated' warning)", async ({ page }) => {
  await open(page, { criterionScores: { k1: 56, k2: 34 } });
  await page.goto(`${BASE}/student/courses/c-rp/evaluation`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Exercise/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Exercise" });
  await expect(dialog.getByText("56 / 60")).toBeVisible();
  await expect(dialog.getByText("34 / 40")).toBeVisible();
  await expect(dialog.getByText(/Estimated from the criteria weights/)).toHaveCount(0);
});

test("the student-flow mock: every graded submission has criterion scores that add up to its score and stay within each maximum", async () => {
  const files = ["public/mock-data/student-flow-mockup.json", "public/mock-data/student-flow-mockup-en.json", "test-data/student-flow-mockup.json", "test-data/student-flow-mockup-en.json"];
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    const rubricOf = new Map<string, { criteria: { id: string; maxPoints: number }[] }>(d.rubrics.map((r: { assignmentId: string }) => [r.assignmentId, r]));
    let checked = 0;
    for (const s of d.submissions) {
      const rubric = rubricOf.get(s.assignmentId);
      if (s.status !== "graded" || !rubric) continue;
      expect(s.criterionScores, `${f} ${s.id}`).toBeDefined();
      const sum = rubric.criteria.reduce((n, c) => n + s.criterionScores[c.id], 0);
      expect(sum, `${f} ${s.id} sum`).toBe(s.instructorScore);
      for (const c of rubric.criteria) {
        expect(Number.isInteger(s.criterionScores[c.id])).toBe(true);
        expect(s.criterionScores[c.id]).toBeGreaterThanOrEqual(0);
        expect(s.criterionScores[c.id]).toBeLessThanOrEqual(c.maxPoints);
      }
      checked++;
    }
    expect(checked, f).toBe(7);
  }
  // public and test-data copies stay identical
  for (const n of ["student-flow-mockup.json", "student-flow-mockup-en.json"]) {
    expect(fs.readFileSync(`public/mock-data/${n}`, "utf8")).toBe(fs.readFileSync(`test-data/${n}`, "utf8"));
  }
});
