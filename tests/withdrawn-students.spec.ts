import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 24/9/2569 — a student who withdrew is left out of every class-level number and sits on their own
// "Withdrawn" tab (Score Book + the assignment's Grading page), the way archived courses do.
//
//   HW 1 (/100):  Amy 80 graded · Bo 60 graded · Cat (WITHDRAWN) 20, still "needs review"
//   class average without Cat = (80 + 60) / 2 = 70%   ·  with Cat it would be 53%
//   Cat's open review must not stop the teacher from finishing grading.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-wd", name: "Withdrawals", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "ct-wd", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076999", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-wd", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-wd"] };
const PEOPLE = [
  ["69070201", "Amy", "Active"], ["69070202", "Bo", "Active"], ["69070203", "Cat", "Leaver"],
] as const;
const cohort = PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `cs-${i}`, studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`, program: "CE", status: "active",
}));
const roster = (withdrawn: boolean) => PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `r-${i}`, courseId: "c-wd", studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`,
  sequenceNumber: i + 1, enrollmentStatus: withdrawn && i === 2 ? "withdrawn" : "enrolled",
}));
const ASSIGNMENT = {
  id: "hw1", courseId: "c-wd", name: "HW 1", description: "", dueDate: "2026-01-10", maxPoints: 100,
  acceptsFiles: true, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW,
};
const sub = (id: string, studentId: string, status: "graded" | "need_review", score: number) => ({
  id, assignmentId: "hw1", studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: score, instructorScore: status === "graded" ? score : null,
  instructorComment: "", externalUseConsent: false, status, updatedAt: "2026-01-05T10:00:00.000Z",
});
const SUBMISSIONS = [sub("s1", "69070201", "graded", 80), sub("s2", "69070202", "graded", 60), sub("s3", "69070203", "need_review", 20)];

async function open(page: Page, url: string, withdrawn = true) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("wd_seeded")) return;
    sessionStorage.setItem("wd_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.submissions));
  }, { course: COURSE, teacher: TEACHER, cohort, roster: roster(withdrawn), assignment: ASSIGNMENT, submissions: SUBMISSIONS });
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle");
}

test.describe("Withdrawn students — Score Book", () => {
  test("the withdrawn student is off the class list and out of the average", async ({ page }) => {
    await open(page, "/teacher/courses/c-wd/results");
    await expect(page.getByText("2 students", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Amy" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cat" })).toHaveCount(0);
    await expect(page.getByText("70%").first()).toBeVisible(); // class average
  });

  test("a Withdrawn tab (with a count) shows them, without the class stats", async ({ page }) => {
    await open(page, "/teacher/courses/c-wd/results");
    await expect(page.getByRole("tab", { name: /Enrolled\s*2/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /Withdrawn\s*1/ }).click();
    await expect(page.getByRole("cell", { name: "Cat" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Amy" })).toHaveCount(0);
    await expect(page.getByText("Class average")).toHaveCount(0);
  });

  test("with nobody withdrawn there are no tabs at all", async ({ page }) => {
    await open(page, "/teacher/courses/c-wd/results", false);
    await expect(page.getByRole("cell", { name: "Cat" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Withdrawn/ })).toHaveCount(0);
  });
});

test.describe("Withdrawn students — Grading", () => {
  test("their open review doesn't block Finish & announce, and the counts skip them", async ({ page }) => {
    await open(page, "/teacher/courses/c-wd/assignments/hw1/grading");
    await expect(page.getByRole("button", { name: /finish & announce/i }).first()).toBeVisible();
    await expect(page.getByText("/ 2 · 0 pending")).toBeVisible();
  });

  test("the Withdrawn tab lists their submission", async ({ page }) => {
    await open(page, "/teacher/courses/c-wd/assignments/hw1/grading");
    await expect(page.getByText("Cat Leaver")).toHaveCount(0);
    await page.getByRole("tab", { name: /Withdrawn\s*1/ }).click();
    await expect(page.getByText("Student 69070203").first()).toBeVisible();
  });
});

test.describe("Withdrawn students — course numbers", () => {
  test("My Courses counts only enrolled students, and their open review doesn't stop it reading All Graded", async ({ page }) => {
    await open(page, "/teacher/courses");
    await expect(page.getByText("2 Students")).toBeVisible();
    await expect(page.getByText("All Graded")).toBeVisible();
  });
});
