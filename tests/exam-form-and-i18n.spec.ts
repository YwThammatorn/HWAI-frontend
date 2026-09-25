import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 26/9/2569 — three small clean-ups:
//  1. the Exam form no longer shows file / submission-type controls (nothing is submitted),
//  2. dates follow the language button (some pages had "th-TH" / "en-US" hard-coded),
//  3. a few labels that stayed English in Thai mode, and the student TERM value colour.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = { id: "c-fx", name: "Web", description: "", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", sectionNumber: "2", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW };

async function seed(page: Page, lang: "en" | "th", user: object, extra: Record<string, unknown> = {}) {
  await page.addInitScript(([l, u, c, x]) => {
    if (sessionStorage.getItem("fx")) return;
    sessionStorage.setItem("fx", "1");
    localStorage.setItem("hwai_lang", l as string);
    localStorage.setItem("hwai_user", JSON.stringify(u));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([c]));
    localStorage.setItem("hwai_assignments_v1", "[]");
    localStorage.setItem("hwai_rubrics_v1", "[]");
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
  }, [lang, user, COURSE, extra] as const);
}
const TEACHER = { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" };
const STUDENT = { name: "Ann", email: "69070401@kmitl.ac.th", role: "student", studentId: "69070401" };
const ANN = [{ id: "r1", courseId: "c-fx", studentId: "69070401", firstName: "Ann", lastName: "S", email: "69070401@kmitl.ac.th", sequenceNumber: 1, enrollmentStatus: "enrolled" }];

test.describe("Exam form hides the file controls", () => {
  test("New Assignment: Exam on hides Accept Files / file types / Submission Type, and the saved exam has fixed file settings", async ({ page }) => {
    await seed(page, "en", TEACHER);
    await page.goto(`${BASE}/teacher/courses/c-fx/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/User Research Report/i).fill("Final exam");

    await expect(page.getByRole("button", { name: "Accept Files" })).toBeVisible();
    await expect(page.getByText("Submission Type")).toBeVisible();
    // group submission chosen first, then Exam on: the group setting must not leak into the exam
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByRole("button", { name: "Accept Files" })).toHaveCount(0);
    await expect(page.getByText("Submission Type")).toHaveCount(0);
    await expect(page.getByText("submit an exam")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();

    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    const [saved] = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]"));
    expect(saved).toMatchObject({ isExam: true, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null });
  });

  test("Exam can be created even after all file types were switched off", async ({ page }) => {
    await seed(page, "en", TEACHER);
    await page.goto(`${BASE}/teacher/courses/c-fx/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/User Research Report/i).fill("Quiz");
    await expect(page.getByText("Select at least one file type")).toHaveCount(0);
    // switch the two selected file types (Figma, PDF) off → a normal assignment can't be created…
    await page.getByRole("button", { name: "Figma", exact: true }).click();
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(page.getByText("Select at least one file type")).toBeVisible();
    // …but an exam doesn't need one
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("Edit Assignment hides them for an exam too", async ({ page }) => {
    const exam = { id: "a-ex", courseId: "c-fx", name: "Midterm", description: "", maxPoints: 50, acceptsFiles: false, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: true, createdAt: NOW };
    await seed(page, "en", TEACHER, { hwai_assignments_v1: [exam] });
    await page.goto(`${BASE}/teacher/courses/c-fx/assignments/a-ex/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Exam Assignment" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Accept Files" })).toHaveCount(0);
    await expect(page.getByText("Submission Type")).toHaveCount(0);
    await page.getByRole("button", { name: "Exam Assignment" }).click(); // off again → they come back
    await expect(page.getByRole("button", { name: "Accept Files" })).toBeVisible();
  });
});

test.describe("Language button changes dates and the leftover labels", () => {
  const asg = { id: "a-1", courseId: "c-fx", name: "Report", description: "", dueDate: "2026-09-05", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: ["r-1"], createdAt: NOW };
  const rubric = { id: "r-1", assignmentId: "a-1", name: "R", criteria: [{ id: "k1", name: "Clarity", description: "", maxPoints: 100, levels: [] }] };

  test("teacher assignment list: English 'Sep 5, 2026', Thai a Thai date, and 'Rubric' is translated", async ({ page }) => {
    await seed(page, "en", TEACHER, { hwai_assignments_v1: [asg], hwai_rubrics_v1: [rubric] });
    await page.goto(`${BASE}/teacher/courses/c-fx/assignments`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Sep 5, 2026").first()).toBeVisible();
    await page.getByRole("button", { name: "Toggle language" }).click();
    await expect(page.getByText("Sep 5, 2026")).toHaveCount(0);
    await expect(page.getByText(/5 ก\.ย\. 2569/).first()).toBeVisible();
    await expect(page.getByText("เกณฑ์การให้คะแนน").first()).toBeVisible();
  });

  test("student classwork in English no longer shows a Thai date (it was hard-coded th-TH)", async ({ page }) => {
    await seed(page, "en", STUDENT, { hwai_assignments_v1: [{ ...asg, dueDate: "2027-09-05" }], hwai_students_v1: ANN });
    await page.goto(`${BASE}/student/courses/c-fx/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Sep 5").first()).toBeVisible();
    await expect(page.getByText(/ก\.ย\./)).toHaveCount(0);
  });

  test("teacher overview: the Email label follows the language", async ({ page }) => {
    await seed(page, "th", TEACHER);
    await page.goto(`${BASE}/teacher/courses/c-fx`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("อีเมล", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Email", { exact: true })).toHaveCount(0);
  });

  test("admin Courses: Section labels are Thai in Thai mode", async ({ page }) => {
    const versions = [{ id: "cv-x", program: "CE", label: "หลักสูตร CE", effectiveFrom: 2569 }];
    const templates = [{ id: "ct-x", curriculumVersionId: "cv-x", code: "01", name: "Web", description: "" }];
    await seed(page, "th", { name: "Admin", email: "admin@kmitl.ac.th", role: "admin" }, {
      hwai_curriculum_versions_v1: versions, hwai_course_templates_v1: templates,
      hwai_courses_v2: [{ ...COURSE, courseTemplateId: "ct-x", code: "01" }],
    });
    await page.goto(`${BASE}/admin/courses`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("กลุ่ม 2", { exact: true })).toBeVisible();
    await expect(page.getByText("1 กลุ่มเรียน", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sec 2", { exact: true })).toHaveCount(0);
  });
});

test("student My Courses: the Term value is body text colour, not the accent green", async ({ page }) => {
  await seed(page, "en", STUDENT, { hwai_students_v1: ANN });
  await page.goto(`${BASE}/student/courses`);
  await page.waitForLoadState("networkidle");
  const value = (label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::p[1]");
  const term = await value("Term").evaluate((e) => getComputedStyle(e).color);
  const section = await value("Section").evaluate((e) => getComputedStyle(e).color);
  expect(term).toBe(section);
});
