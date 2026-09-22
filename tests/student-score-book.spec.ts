import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Student Evaluation page, redesigned (22/9/2569) to adapt the teacher Score Book's visual language:
// same ScoreCell tones/legend/rubric-breakdown as the teacher's matrix, transposed to one row (rows =
// assignments, since there's only one student). Category/total math is unchanged (computeCategoryGradeRows
// / computeTotalSoFar) — only the per-assignment cell states and layout are new.
//
// Seed, numbers worked by hand:
//   Homework 50%: HW1 (/100, past due, graded 90, rubric w/ exact criterionScores)
//                 HW2 (/100, past due, graded 70, rubric but NO criterionScores saved → estimated)
//                 HW3 (/100, past due, no submission → missing)
//                 HW4 (/100, due 2099, no submission → not due yet, "—")
//   Midterm  50%: MID1 (/100, past due, submitted but ungraded → pending)
//   No category:  EXTRA (/10, past due, graded 8 → excluded from the total)
//   Homework: (90+70)/(100+100) = 80% → contribution 40.0 ; Midterm: nothing graded → null
//   Total so far = 40.0 / 50 (1 of 2 categories) ; normalized = 40/50*100 = 80% → tone ok → letter A

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-sesb", name: "Programming", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "ct-sesb", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const STUDENT_RECORD = { id: "r-sesb-1", courseId: "c-sesb", studentId: "69070101", firstName: "Somchai", lastName: "Jaidee", email: "69070101@kmitl.ac.th", cohort: "CE69", sequenceNumber: 1, enrollmentStatus: "enrolled" };
const CATS = [
  { id: "cat-hw", courseId: "c-sesb", name: "Homework", weight: 50, createdAt: NOW, updatedAt: NOW },
  { id: "cat-mid", courseId: "c-sesb", name: "Midterm", weight: 50, createdAt: NOW, updatedAt: NOW },
];
const asg = (id: string, name: string, dueDate: string, maxPoints: number, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-sesb", name, description: "", dueDate, maxPoints, acceptsFiles: true, fileTypes: [],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra,
});
const ASSIGNMENTS = [
  asg("hw1", "HW 1", "2026-01-10", 100, { categoryId: "cat-hw" }),
  asg("hw2", "HW 2", "2026-01-12", 100, { categoryId: "cat-hw" }),
  asg("hw3", "HW 3", "2026-01-14", 100, { categoryId: "cat-hw" }),
  asg("hw4", "HW 4", "2099-12-31", 100, { categoryId: "cat-hw" }),
  asg("mid1", "Midterm Exam", "2026-01-20", 100, { categoryId: "cat-mid" }),
  asg("extra", "Extra Credit", "2026-01-05", 10),
];
const RUBRICS = [
  { id: "r-hw1", assignmentId: "hw1", name: "HW 1 rubric", createdAt: NOW, updatedAt: NOW, criteria: [
    { id: "crit-1a", name: "Correctness", description: "", maxPoints: 70, weight: 70, levels: [] },
    { id: "crit-1b", name: "Style", description: "", maxPoints: 30, weight: 30, levels: [] },
  ] },
  { id: "r-hw2", assignmentId: "hw2", name: "HW 2 rubric", createdAt: NOW, updatedAt: NOW, criteria: [
    { id: "crit-2a", name: "Completeness", description: "", maxPoints: 100, weight: 100, levels: [] },
  ] },
];
const sub = (id: string, assignmentId: string, status: "graded" | "need_review" | "not_graded", score: number | null, extra: Record<string, unknown> = {}) => ({
  id, assignmentId, studentId: "69070101", studentName: "Somchai Jaidee", email: "69070101@kmitl.ac.th",
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: score, instructorScore: status === "graded" ? score : null,
  instructorComment: "", externalUseConsent: false, status, updatedAt: "2026-01-05T10:00:00.000Z", ...extra,
});
const SUBMISSIONS = [
  sub("s-hw1", "hw1", "graded", 90, { criterionScores: { "crit-1a": 65, "crit-1b": 25 } }),
  sub("s-hw2", "hw2", "graded", 70), // rubric exists, no criterionScores saved → estimated breakdown
  // hw3: no submission at all → missing (past due)
  // hw4: no submission at all → not due yet
  sub("s-mid1", "mid1", "need_review", 60), // submitted, awaiting grading → pending
  sub("s-extra", "extra", "graded", 8),
];

type Opts = { lang?: "en" | "th"; empty?: "all" | "noCategories" };

async function open(page: Page, o: Opts = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("sesb_seeded")) return; // addInitScript re-runs on every navigation
    sessionStorage.setItem("sesb_seeded", "1");
    localStorage.setItem("hwai_lang", d.lang);
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somchai Jaidee", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.empty === "all" ? [] : [d.studentRecord]));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(d.empty === "all" || d.empty === "noCategories" ? [] : d.cats));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.empty === "all" ? [] : d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.empty === "all" ? [] : d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.empty === "all" ? [] : d.submissions));
  }, { lang: o.lang ?? "en", empty: o.empty, course: COURSE, studentRecord: STUDENT_RECORD, cats: CATS, assignments: ASSIGNMENTS, rubrics: RUBRICS, submissions: SUBMISSIONS });
  await page.goto(`${BASE}/student/courses/c-sesb/evaluation`);
  await page.waitForLoadState("networkidle");
}

const rowOf = (page: Page, assignmentName: string) => page.locator("main tbody tr", { hasText: assignmentName });
const scoreCell = (page: Page, assignmentName: string) => rowOf(page, assignmentName).locator("td").nth(1);

test.describe("Student Evaluation — layout", () => {
  test("header shows the course and assignment count; stat cards show graded % and awaiting count", async ({ page }) => {
    await open(page);
    await expect(page.locator("h1")).toHaveText("Evaluation");
    await expect(page.getByText("Programming · 6 assignments")).toBeVisible();
    // 2 graded (hw1, hw2) + 1 excluded-but-graded (extra) = 3/6 = 50%; awaiting = hw3 missing + mid1 pending = 2
    await expect(page.getByText("Graded", { exact: true })).toBeVisible();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText("Awaiting grading", { exact: true })).toBeVisible();
    await expect(page.getByText("2", { exact: true })).toBeVisible();
  });

  test("category section headers show name, weight, and the category's own percent/points, or 'Not graded yet'", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Homework · 50%")).toBeVisible();
    await expect(page.getByText("80%", { exact: true })).toBeVisible();
    await expect(page.getByText("(160/200 pts)")).toBeVisible();
    await expect(page.getByText("Midterm · 50%")).toBeVisible();
    await expect(page.getByText("Not graded yet")).toBeVisible();
  });

  test("uncategorized assignments get their own section, marked excluded from the total", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Uncategorized")).toBeVisible();
    await expect(page.getByText("Excluded from the total")).toBeVisible();
    await expect(page.getByText("Extra Credit")).toBeVisible();
  });

  test("assignment names link to the classwork detail page", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("link", { name: "HW 1" })).toHaveAttribute("href", "/student/courses/c-sesb/classwork/hw1");
  });
});

test.describe("Student Evaluation — cells", () => {
  test("graded cells show score/max with a colour band that follows the percentage", async ({ page }) => {
    await open(page);
    const hw1 = scoreCell(page, "HW 1").locator("span").first();
    await expect(hw1).toHaveText("90/100");
    await expect(hw1).toHaveClass(/s-ok-bg/);
    const hw2 = scoreCell(page, "HW 2").locator("span").first();
    await expect(hw2).toHaveText("70/100");
    await expect(hw2).toHaveClass(/s-info-bg/);
    const extra = scoreCell(page, "Extra Credit").locator("span").first();
    await expect(extra).toHaveText("8/10");
    await expect(extra).toHaveClass(/s-ok-bg/);
  });

  test("missing, pending, and not-due-yet cells are told apart", async ({ page }) => {
    await open(page);
    await expect(scoreCell(page, "HW 3")).toContainText("Missing");
    await expect(scoreCell(page, "HW 3").locator("span").first()).toHaveClass(/s-err-bg/);
    await expect(scoreCell(page, "Midterm Exam")).toContainText("Pending");
    await expect(scoreCell(page, "Midterm Exam").locator("span").first()).toHaveClass(/s-warn-bg/);
    await expect(scoreCell(page, "HW 4")).toHaveText("—");
  });
});

test.describe("Student Evaluation — rubric breakdown", () => {
  test("a graded assignment with real per-criterion scores shows them exactly, no estimate notice", async ({ page }) => {
    await open(page);
    await rowOf(page, "HW 1").getByRole("button", { name: /rubric breakdown/i }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Correctness")).toBeVisible();
    await expect(modal.getByText("65 / 70")).toBeVisible();
    await expect(modal.getByText("25 / 30")).toBeVisible();
    await expect(modal.getByText(/estimated/i)).toHaveCount(0);
  });

  test("a graded assignment with no saved criterion scores is estimated from the weights, and says so", async ({ page }) => {
    await open(page);
    await rowOf(page, "HW 2").getByRole("button", { name: /rubric breakdown/i }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText(/estimated from the criteria weights/i)).toBeVisible();
    await expect(modal.getByText("Completeness")).toBeVisible();
    // Scoped to the criteria table body — the total row below also happens to read "70 / 100" here.
    await expect(modal.locator("tbody").getByText("70 / 100")).toBeVisible(); // round(1.0 * 70)
  });

  test("assignments without a rubric have no expand control", async ({ page }) => {
    await open(page);
    await expect(rowOf(page, "Extra Credit").getByRole("button")).toHaveCount(0);
  });
});

test.describe("Student Evaluation — total and letter", () => {
  test("weighted total so far, what it is out of, and the letter grade", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Total so far")).toBeVisible();
    await expect(page.getByText("40.0%")).toBeVisible();
    await expect(page.getByText(/Based on 1\/2 categories graded/i)).toBeVisible();
    await expect(page.getByText("A", { exact: true })).toBeVisible();
  });
});

test.describe("Student Evaluation — fallback and empty states", () => {
  test("no categories configured falls back to a flat list, single un-grouped table", async ({ page }) => {
    await open(page, { empty: "noCategories" });
    await expect(page.getByText(/hasn't set up grade categories/i)).toBeVisible();
    await expect(page.getByText("Total so far")).toHaveCount(0);
    await expect(page.getByText("HW 1")).toBeVisible();
    const hw1 = scoreCell(page, "HW 1").locator("span").first();
    await expect(hw1).toHaveText("90/100");
    // No section-header row — every assignment sits directly under the plain "Assignment"/"Score" header.
    await expect(page.getByText("Uncategorized")).toHaveCount(0);
  });

  test("no graded work and no categories → empty state", async ({ page }) => {
    await open(page, { empty: "all" });
    await expect(page.getByText(/No evaluation results yet/i)).toBeVisible();
  });
});

test.describe("Student Evaluation — Thai", () => {
  test("Thai UI: labels and category headers", async ({ page }) => {
    await open(page, { lang: "th" });
    await expect(page.locator("h1")).toHaveText("ผลการประเมิน");
    await expect(page.getByText("รอตรวจ").first()).toBeVisible();
    await expect(page.getByText("ไม่ส่ง").first()).toBeVisible();
    await expect(page.getByText("คะแนนรวมเท่าที่ตรวจแล้ว")).toBeVisible();
  });
});
