import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 25/9/2569 — an Exam has no due date, students never submit it, and the teacher types every score into
// one table (there is no submission to open). The student only waits for the score.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-ex", name: "Exams 101", description: "", status: "active",
  coverColor: "#0F766E", courseTemplateId: "ct-ex", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076555", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-ex", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ex"] };
const PEOPLE = [["69070301", "Nok", "Exam"], ["69070302", "Pim", "Exam"]] as const;
const COHORT = PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `cs-${i}`, studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`, program: "CE", status: "active",
}));
const ROSTER = PEOPLE.map(([studentId, firstName, lastName], i) => ({
  id: `r-${i}`, courseId: "c-ex", studentId, firstName, lastName, email: `${studentId}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled",
}));
const EXAM = {
  id: "ex1", courseId: "c-ex", name: "Midterm exam", description: "Chapters 1-5", maxPoints: 50, acceptsFiles: false, fileTypes: [],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: true, createdAt: NOW, updatedAt: NOW,
};
const HOMEWORK = {
  id: "hw1", courseId: "c-ex", name: "Homework 1", description: "", dueDate: "2099-12-31", maxPoints: 10, acceptsFiles: true, fileTypes: ["pdf"],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW,
};

async function seed(page: Page, role: "teacher" | "student", extra: { submissions?: unknown[]; withHomework?: boolean; announced?: boolean } = {}) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("ex_seeded")) return;
    sessionStorage.setItem("ex_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(d.role === "student"
      ? { name: "Nok Exam", email: "69070301@kmitl.ac.th", role: "student", studentId: "69070301" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.withHomework ? [d.exam, d.homework] : [d.exam]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.submissions));
  }, { role, course: COURSE, teacher: TEACHER, cohort: COHORT, roster: ROSTER, exam: extra.announced ? { ...EXAM, gradingFinalized: true } : EXAM, homework: HOMEWORK, submissions: extra.submissions ?? [], withHomework: !!extra.withHomework });
}

const graded = (studentId: string, score: number) => ({
  id: `s-${studentId}`, assignmentId: "ex1", studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: NOW, fileUrl: null, aiScore: null, instructorScore: score, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: NOW,
});

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]"));

test.describe("Exam — teacher form", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("exf")) return;
      sessionStorage.setItem("exf", "1");
      const now = "2026-01-01T00:00:00.000Z";
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-exf", name: "Web", description: "", status: "active", coverColor: "#0F766E", createdAt: now, updatedAt: now }]));
      localStorage.setItem("hwai_assignments_v1", "[]");
      localStorage.setItem("hwai_rubrics_v1", "[]");
    });
  });

  test("turning on Exam removes the Due Date field, and Create no longer needs one", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-exf/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/User Research Report/i).fill("Final exam");
    await expect(page.getByText("Due Date")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeDisabled(); // a normal assignment needs a date

    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByText("Due Date")).toHaveCount(0);
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();

    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"));
    expect(saved).toHaveLength(1);
    expect(saved[0].isExam).toBe(true);
    expect(saved[0].dueDate).toBeUndefined();
  });

  test("turning Exam off brings the Due Date field back", async ({ page }) => {
    await page.goto(`${BASE}/teacher/courses/c-exf/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.locator('input[type="date"]')).toHaveCount(1);
  });
});

test.describe("Exam — teacher enters the scores", () => {
  test("every enrolled student has a row, and saving creates their score without any submission", async ({ page }) => {
    await seed(page, "teacher");
    await page.goto(`${BASE}/teacher/courses/c-ex/assignments/ex1/grading`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Exam · no due date").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exam scores" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Nok Exam" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Pim Exam" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save scores" })).toBeDisabled(); // nothing changed yet

    await page.getByLabel("Score for Nok Exam").fill("42");
    await page.getByRole("button", { name: "Save scores" }).click();

    const subs = await stored(page);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ assignmentId: "ex1", studentId: "69070301", instructorScore: 42, status: "graded", fileUrl: null });
    await expect(page.getByRole("row", { name: /Nok Exam/ }).getByText("Scored")).toBeVisible();
    await expect(page.getByRole("row", { name: /Pim Exam/ }).getByText("Not scored")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish & announce" })).toHaveCount(0); // Pim still has no score
  });

  test("a score above the maximum is rejected, and Finish & announce appears once everyone is scored", async ({ page }) => {
    await seed(page, "teacher", { submissions: [graded("69070301", 42)] });
    await page.goto(`${BASE}/teacher/courses/c-ex/assignments/ex1/grading`);
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Score for Pim Exam").fill("51");
    await expect(page.getByText("0–50 only")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save scores" })).toBeDisabled();

    await page.getByLabel("Score for Pim Exam").fill("37.5");
    await page.getByRole("button", { name: "Save scores" }).click();
    await expect(page.getByRole("button", { name: "Finish & announce" }).first()).toBeVisible();
    const subs = await stored(page);
    expect(subs.find((s: { studentId: string }) => s.studentId === "69070302")).toMatchObject({ instructorScore: 37.5, status: "graded" });
  });

  test("clearing a score puts the student back to not scored", async ({ page }) => {
    await seed(page, "teacher", { submissions: [graded("69070301", 42)] });
    await page.goto(`${BASE}/teacher/courses/c-ex/assignments/ex1/grading`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Score for Nok Exam").fill("");
    await page.getByRole("button", { name: "Save scores" }).click();
    await expect(page.getByRole("row", { name: /Nok Exam/ }).getByText("Not scored")).toBeVisible();
    expect((await stored(page))[0]).toMatchObject({ status: "not_graded", instructorScore: null });
  });

  test("the Score Book shows the exam score, and '—' (never 'Missing') for someone with no score", async ({ page }) => {
    await seed(page, "teacher", { submissions: [graded("69070301", 42)] });
    await page.goto(`${BASE}/teacher/courses/c-ex/results`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("row", { name: /Nok Exam/ }).getByText("42")).toBeVisible();
    // (the legend also says "Missing", so look inside the student's own row)
    const pim = page.getByRole("row", { name: /Pim Exam/ });
    await expect(pim.getByText("Missing")).toHaveCount(0);
    await expect(pim.getByText("—").first()).toBeVisible();
  });
});

test.describe("Exam — student side", () => {
  test("nothing to submit: the list says awaiting score, and the detail page has no submit button", async ({ page }) => {
    await seed(page, "student", { withHomework: true });
    await page.goto(`${BASE}/student/courses/c-ex/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Awaiting score (1)")).toBeVisible();
    await expect(page.getByText("Exam · nothing to submit")).toBeVisible();

    await page.getByRole("link", { name: /Midterm exam/ }).first().click();
    await expect(page.getByText("Waiting for your exam score")).toBeVisible();
    await expect(page.getByText("Exam — nothing to submit")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)$/ })).toHaveCount(0);
    await expect(page.getByText("Not submitted yet")).toHaveCount(0);
    await expect(page.getByLabel("Link")).toHaveCount(0);
  });

  test("once the teacher records the score, the student sees it", async ({ page }) => {
    await seed(page, "student", { submissions: [graded("69070301", 42)], announced: true });
    await page.goto(`${BASE}/student/courses/c-ex/classwork/ex1`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("42/50")).toBeVisible();
    await expect(page.getByText("Waiting for your exam score")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)$/ })).toHaveCount(0);
  });

  test("an exam never shows up as an upcoming deadline on the student home page", async ({ page }) => {
    await seed(page, "student");
    await page.goto(`${BASE}/student`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Midterm exam")).toHaveCount(0);
  });
});
