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
