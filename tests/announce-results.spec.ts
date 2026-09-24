import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 25/9/2569 — "Finish Grading" is now "Finish & announce": students see no score (and no comment, no
// breakdown) until the teacher confirms it, and a graded submission can't be overwritten meanwhile.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-an", name: "Announcements", description: "", status: "active", source: "manual",
  coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "ct-an", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076777", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-an", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-an"] };
const PEOPLE = [["69070401", "Ann", "Student"], ["69070402", "Ben", "Student"]] as const;
const COHORT = PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `cs-${i}`, studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`, program: "CE", status: "active",
}));
const ROSTER = PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `r-${i}`, courseId: "c-an", studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled",
}));
const assignment = (finalized: boolean) => ({
  id: "hw", courseId: "c-an", name: "Homework", description: "", dueDate: "2026-01-10", maxPoints: 10, acceptsFiles: true, fileTypes: ["pdf"],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], gradingFinalized: finalized, createdAt: NOW, updatedAt: NOW,
});
const sub = (studentId: string) => ({
  id: `s-${studentId}`, assignmentId: "hw", studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: 9, instructorScore: 9, instructorComment: "Nice work",
  externalUseConsent: false, status: "graded", updatedAt: NOW,
});

async function seed(page: Page, role: "teacher" | "student", finalized: boolean) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("an_seeded")) return;
    sessionStorage.setItem("an_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(d.role === "student"
      ? { name: "Ann Student", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([d.assignment]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.submissions));
  }, { role, course: COURSE, teacher: TEACHER, cohort: COHORT, roster: ROSTER, assignment: assignment(finalized), submissions: [sub("69070401"), sub("69070402")] });
}

const finalizedFlag = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0].gradingFinalized);

test.describe("Announcing results — student side", () => {
  test("before the announcement a graded submission reads as awaiting grade, with no score or comment", async ({ page }) => {
    await seed(page, "student", false);
    await page.goto(`${BASE}/student/courses/c-an/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("9/10")).toHaveCount(0);
    await expect(page.getByText("Graded", { exact: true })).toHaveCount(0);

    await page.goto(`${BASE}/student/courses/c-an/classwork/hw`);
    await expect(page.getByText(/awaiting grade/i)).toBeVisible();
    await expect(page.getByText("Nice work")).toHaveCount(0);
    // and the finished work can't be resubmitted over the top of its grade
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)$/ })).toHaveCount(0);
  });

  test("the Evaluation page shows nothing graded yet", async ({ page }) => {
    await seed(page, "student", false);
    await page.goto(`${BASE}/student/courses/c-an/evaluation`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("9/10")).toHaveCount(0);
  });

  test("once announced, the score and the teacher's comment appear", async ({ page }) => {
    await seed(page, "student", true);
    await page.goto(`${BASE}/student/courses/c-an/classwork/hw`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("9/10")).toBeVisible();
    await expect(page.getByText("Nice work")).toBeVisible();
  });
});

test.describe("Announcing results — teacher side", () => {
  test("Finish & announce asks first; Not yet changes nothing", async ({ page }) => {
    await seed(page, "teacher", false);
    await page.goto(`${BASE}/teacher/courses/c-an/assignments/hw/grading`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Finish & announce" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Announce results to students?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("All 2 of 2 are graded")).toBeVisible();
    await expect(dialog.getByText(/Score Book are locked/)).toBeVisible();

    await dialog.getByRole("button", { name: "Not yet" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await finalizedFlag(page)).toBeFalsy();
    await expect(page.getByText("Results announced")).toHaveCount(0);
  });

  test("announcing marks it announced; reopening warns that students lose sight of the scores", async ({ page }) => {
    await seed(page, "teacher", false);
    await page.goto(`${BASE}/teacher/courses/c-an/assignments/hw/grading`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Finish & announce" }).first().click();
    await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Announce results" }).click();
    await expect(page.getByText("Results announced")).toBeVisible();
    await expect(page.getByRole("link", { name: /view results/i }).first()).toBeVisible();
    expect(await finalizedFlag(page)).toBe(true);

    let warning = "";
    page.once("dialog", (d) => { warning = d.message(); d.accept(); });
    await page.getByRole("button", { name: "Reopen grading" }).click();
    expect(warning).toContain("won't see scores");
    await expect(page.getByText("Results announced")).toHaveCount(0);
    expect(await finalizedFlag(page)).toBe(false);
  });
});
