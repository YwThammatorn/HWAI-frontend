import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Student-facing side of this session's new systems: the aggregated
// announcements feed on the home page, the per-course announcements page
// (previously a permanent empty-state stub), and the rubric now shown on the
// assignment detail page.

const COURSE_A = {
  id: "c-sp4-a", name: "UI/UX Design", description: "Human-centered design fundamentals",
  status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const COURSE_B = {
  id: "c-sp4-b", name: "Data Structures", description: "DS course",
  status: "active", source: "manual", coverColor: "#F97316", iconColor: "#F97316",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const STUDENT_RECORD_A = {
  id: "sr-sp4-a", courseId: "c-sp4-a", studentId: "64070501", firstName: "Somchai", lastName: "Jaidee", email: "s1@kmitl.ac.th", cohort: "CE69",
};
const STUDENT_RECORD_B = {
  id: "sr-sp4-b", courseId: "c-sp4-b", studentId: "64070501", firstName: "Somchai", lastName: "Jaidee", email: "s1@kmitl.ac.th", cohort: "CE69",
};

// One announcement per course, timestamped so course B's is the more recent
// of the two — the home feed must sort newest first regardless of course.
const ANNOUNCEMENTS = [
  { id: "ann-sp4-a", authorCourseId: "c-sp4-a", scope: "this-section", title: "UX kickoff", body: "Welcome to UI/UX Design.", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-01-01T09:00:00.000Z" },
  { id: "ann-sp4-b", authorCourseId: "c-sp4-b", scope: "this-section", title: "DS midterm date", body: "Midterm is on the 20th.", createdAt: "2026-01-02T09:00:00.000Z", updatedAt: "2026-01-02T09:00:00.000Z" },
];

const ASSIGNMENT = {
  id: "a-sp4", courseId: "c-sp4-a", name: "Wireframe Assignment",
  description: "Submit low-fidelity wireframes", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "individual",
  attachments: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const RUBRIC = {
  id: "r-sp4", assignmentId: "a-sp4", name: "Wireframe Rubric",
  criteria: [
    {
      id: "rc-sp4-1", name: "Clarity of layout", description: "Screens are easy to understand", maxPoints: 60, weight: 60,
      levels: [{ label: "Excellent", description: "Very clear" }, { label: "Good", description: "Mostly clear" }, { label: "Needs Improvement", description: "Confusing" }],
    },
    {
      id: "rc-sp4-2", name: "Consistency", description: "Consistent spacing and components", maxPoints: 40, weight: 40,
      levels: [{ label: "Excellent", description: "" }, { label: "Good", description: "" }, { label: "Needs Improvement", description: "" }],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

async function seedStudent(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: "Somchai Jaidee", email: "s1@kmitl.ac.th", role: "student", studentId: "64070501",
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(data.courses));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.studentRecords));
    localStorage.setItem("hwai_announcements_v1", JSON.stringify(data.announcements));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([data.rubric]));
  }, {
    courses: [COURSE_A, COURSE_B],
    studentRecords: [STUDENT_RECORD_A, STUDENT_RECORD_B],
    announcements: ANNOUNCEMENTS,
    assignment: ASSIGNMENT,
    rubric: RUBRIC,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P4 — Student Home Announcements Feed", () => {
  test.beforeEach(async ({ page }) => { await seedStudent(page); });

  test("shows announcements from every enrolled course, newest first", async ({ page }) => {
    await page.goto(`${BASE}/student`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("DS midterm date")).toBeVisible();
    await expect(page.getByText("UX kickoff")).toBeVisible();
    await expect(page.getByText("Data Structures").first()).toBeVisible();
    await expect(page.getByText("UI/UX Design").first()).toBeVisible();

    // Newest (course B's) announcement should appear before the older one.
    const firstTitleBox = await page.getByText("DS midterm date").boundingBox();
    const secondTitleBox = await page.getByText("UX kickoff").boundingBox();
    expect(firstTitleBox!.y).toBeLessThan(secondTitleBox!.y);
  });

  test("clicking an announcement navigates to that course's announcements page", async ({ page }) => {
    await page.goto(`${BASE}/student`);
    await page.waitForLoadState("networkidle");
    await page.getByText("UX kickoff").click();
    await expect(page).toHaveURL(/\/student\/courses\/c-sp4-a\/announcements/);
  });
});

test.describe("P4 — Student Per-Course Announcements Page", () => {
  test.beforeEach(async ({ page }) => { await seedStudent(page); });

  test("shows the real announcement instead of the old empty-state stub", async ({ page }) => {
    await page.goto(`${BASE}/student/courses/c-sp4-b/announcements`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("DS midterm date")).toBeVisible();
    await expect(page.getByText("Midterm is on the 20th.")).toBeVisible();
    // Should not show the other course's announcement here.
    await expect(page.getByText("UX kickoff")).not.toBeVisible();
  });
});

test.describe("P4 — Assignment Rubric Display", () => {
  test.beforeEach(async ({ page }) => { await seedStudent(page); });

  test("shows the grading rubric criteria and levels", async ({ page }) => {
    await page.goto(`${BASE}/student/courses/c-sp4-a/classwork/a-sp4`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Grading Rubric")).toBeVisible();
    await expect(page.getByText("Clarity of layout")).toBeVisible();
    await expect(page.getByText(/60%.*60 pts/i)).toBeVisible();
    await expect(page.getByText("Consistency")).toBeVisible();
    await expect(page.getByText("Very clear")).toBeVisible();
  });
});

// ── P5 — Weekly Plan / Materials / weighted Evaluation ──────────────────────
// These three teacher-authored systems existed on the teacher side but were
// never surfaced to students at all (no route, no nav link) until this pass.

const WEEKLY_PLAN = [
  { id: "wp-sp5-1", courseId: "c-sp4-a", week: 1, topic: "Intro to UX research", notes: "Bring a laptop", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "wp-sp5-2", courseId: "c-sp4-a", week: 2, topic: "Wireframing basics", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const MATERIALS = [
  { id: "tm-sp5-1", courseId: "c-sp4-a", title: "Week 1 slides", type: "link", source: "url", ref: "https://example.com/slides.pdf", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

// Two categories, equal 50/50 weight. Coursework has one graded (80/100 = 80%,
// contributing 0.8*50=40) and one ungraded item; Midterm has nothing graded
// yet. Total so far should be exactly 40%, based on 1 of 2 categories.
const CATEGORIES = [
  { id: "gc-sp5-1", courseId: "c-sp4-a", name: "Coursework", weight: 50, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "gc-sp5-2", courseId: "c-sp4-a", name: "Midterm", weight: 50, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const EVAL_ASSIGNMENTS = [
  { id: "a-sp5-1", courseId: "c-sp4-a", name: "Lab 1", description: "", dueDate: "2026-01-10", maxPoints: 100, categoryId: "gc-sp5-1", acceptsFiles: true, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "a-sp5-2", courseId: "c-sp4-a", name: "Lab 2", description: "", dueDate: "2026-01-20", maxPoints: 100, categoryId: "gc-sp5-1", acceptsFiles: true, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "a-sp5-3", courseId: "c-sp4-a", name: "Midterm Exam", description: "", dueDate: "2026-02-01", maxPoints: 100, categoryId: "gc-sp5-2", acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  // No categoryId at all — should land in the "Uncategorized" bucket.
  { id: "a-sp5-4", courseId: "c-sp4-a", name: "Bonus Quiz", description: "", dueDate: "2026-01-05", maxPoints: 10, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const EVAL_SUBMISSION_GRADED = {
  id: "sub-sp5-1", assignmentId: "a-sp5-1", studentId: "64070501", studentName: "Somchai Jaidee", email: "s1@kmitl.ac.th",
  submittedAt: "2026-01-09T10:00:00.000Z", fileUrl: null, aiScore: 75, instructorScore: 80, instructorComment: "",
  externalUseConsent: false, status: "graded", updatedAt: "2026-01-10T00:00:00.000Z",
};

async function seedEvaluation(page: Page, opts: { categories?: unknown[]; submissions?: unknown[] } = {}) {
  const { categories = CATEGORIES, submissions = [EVAL_SUBMISSION_GRADED] } = opts;
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: "Somchai Jaidee", email: "s1@kmitl.ac.th", role: "student", studentId: "64070501",
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_students_v1", JSON.stringify([data.studentRecord]));
    localStorage.setItem("hwai_weekly_plan_v1", JSON.stringify(data.weeklyPlan));
    localStorage.setItem("hwai_teaching_materials_v1", JSON.stringify(data.materials));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(data.categories));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(data.assignments));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
  }, {
    course: COURSE_A, studentRecord: STUDENT_RECORD_A, weeklyPlan: WEEKLY_PLAN, materials: MATERIALS,
    categories, assignments: EVAL_ASSIGNMENTS, submissions,
  });
}

test.describe("P5 — Student Weekly Plan Page", () => {
  test("shows teacher-posted weeks with topic and notes", async ({ page }) => {
    await seedEvaluation(page);
    await page.goto(`${BASE}/student/courses/c-sp4-a/weekly-plan`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Intro to UX research")).toBeVisible();
    await expect(page.getByText("Bring a laptop")).toBeVisible();
    await expect(page.getByText("Wireframing basics")).toBeVisible();
  });

  test("empty state when no weekly plan exists", async ({ page }) => {
    await seedEvaluation(page, {});
    await page.addInitScript(() => localStorage.setItem("hwai_weekly_plan_v1", JSON.stringify([])));
    await page.goto(`${BASE}/student/courses/c-sp4-a/weekly-plan`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/No weekly plan yet/i)).toBeVisible();
  });
});

test.describe("P5 — Student Materials Page", () => {
  test("shows teacher-posted materials", async ({ page }) => {
    await seedEvaluation(page);
    await page.goto(`${BASE}/student/courses/c-sp4-a/materials`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Week 1 slides")).toBeVisible();
    await expect(page.getByText("Link")).toBeVisible();
  });

  test("empty state when no materials exist", async ({ page }) => {
    await seedEvaluation(page, {});
    await page.addInitScript(() => localStorage.setItem("hwai_teaching_materials_v1", JSON.stringify([])));
    await page.goto(`${BASE}/student/courses/c-sp4-a/materials`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/No materials yet/i)).toBeVisible();
  });
});

test.describe("P5 — Student Evaluation: weighted grade breakdown", () => {
  test("computes per-category percent and the overall weighted total so far", async ({ page }) => {
    await seedEvaluation(page);
    await page.goto(`${BASE}/student/courses/c-sp4-a/evaluation`);
    await page.waitForLoadState("networkidle");

    // Coursework: only Lab 1 graded (80/100) -> category shows 80%.
    await expect(page.getByText("Coursework")).toBeVisible();
    await expect(page.getByText("80%", { exact: true })).toBeVisible();
    await expect(page.getByText("80/100 pts")).toBeVisible();
    await expect(page.getByText("Lab 2")).toBeVisible();
    await expect(page.getByText("Pending").first()).toBeVisible();

    // Midterm: nothing graded yet.
    await expect(page.getByText("Midterm", { exact: true })).toBeVisible();
    await expect(page.getByText("Not graded yet")).toBeVisible();

    // Overall: 0.8 * 50 = 40%, based on 1 of 2 categories.
    await expect(page.getByText("40.0%")).toBeVisible();
    await expect(page.getByText(/Based on 1\/2 categories graded/i)).toBeVisible();

    // Assignment with no categoryId lands in its own bucket, excluded from the total.
    await expect(page.getByText("Uncategorized")).toBeVisible();
    await expect(page.getByText("Bonus Quiz")).toBeVisible();
  });

  test("falls back to a flat graded-score list when no categories are configured", async ({ page }) => {
    await seedEvaluation(page, { categories: [] });
    await page.goto(`${BASE}/student/courses/c-sp4-a/evaluation`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/hasn't set up grade categories/i)).toBeVisible();
    await expect(page.getByText("Lab 1")).toBeVisible();
    await expect(page.getByText("80/100")).toBeVisible();
  });
});
