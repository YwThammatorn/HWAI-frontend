import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 4/10/2569 — announcing an EXAM takes the teacher to its results page, which shows the same class-statistics
// card (average / min / max / SD + bell curve) the students now see. Ordinary assignments stay on the grading page.
//
// Scores 40, 30, 20 → mean 30.0, min 20, max 40, SD 10.0 (sample, n − 1).

const NOW = "2026-01-01T00:00:00.000Z";
const PEOPLE = [["69070901", "Ann", 40], ["69070902", "Ben", 30], ["69070903", "Cat", 20]] as const;

async function seed(page: Page, o: { exam: boolean; announced?: boolean }) {
  await page.addInitScript(([exam, announced, people]) => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const ppl = people as unknown as [string, string, number][];
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([{ id: "c-ar", name: "Announce Redirect", description: "", status: "active", coverColor: "#0F766E", sectionNumber: "1", code: "01076777", academicYear: 2569, term: 1, createdAt: NOW, updatedAt: NOW }]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([{ id: "t-ar", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ar"] }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `cs-${i}`, studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, program: "CE", status: "active" }))));
    localStorage.setItem("hwai_students_v1", JSON.stringify(ppl.map(([id, f], i) => ({ id: `r-${i}`, courseId: "c-ar", studentId: id, firstName: f, lastName: "Test", email: `${id}@kmitl.ac.th`, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }))));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([{
      id: "as1", courseId: "c-ar", name: exam ? "Midterm exam" : "Homework", description: "", dueDate: exam ? undefined : "2026-01-10", maxPoints: 50,
      acceptsFiles: !exam, fileTypes: [], submissionType: "individual", maxGroupSize: null, rubricIds: [], isExam: exam || undefined,
      gradingFinalized: announced || undefined, createdAt: NOW, updatedAt: NOW,
    }]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(ppl.map(([id, f, score]) => ({
      id: `s-${id}`, assignmentId: "as1", studentId: id, studentName: `${f} Test`, email: `${id}@kmitl.ac.th`, submittedAt: NOW, fileUrl: null,
      aiScore: null, instructorScore: score, instructorComment: "", externalUseConsent: false, status: "graded", updatedAt: NOW,
    }))));
  }, [o.exam, !!o.announced, PEOPLE] as const);
}

const announce = async (page: Page) => {
  await page.goto(`${BASE}/teacher/courses/c-ar/assignments/as1/grading`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Finish & announce" }).first().click();
  await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Announce results" }).click();
};

test("announcing an exam lands on its results page, with the class statistics card students see", async ({ page }) => {
  await seed(page, { exam: true });
  await announce(page);
  // the results route may compile on its first visit in dev, so allow more than the default 5s
  await expect(page).toHaveURL(/\/teacher\/courses\/c-ar\/assignments\/as1\/results$/, { timeout: 20000 });
  await expect(page.getByRole("status")).toContainText("Results announced");
  await expect(page.getByRole("status")).toContainText("each student sees the statistics below");
  const card = page.locator("section").filter({ hasText: "Class statistics · 3 students" }).last();
  await expect(card).toContainText("Midterm exam");
  await expect(card).toContainText("Announced");
  await expect(card.locator("dl")).toContainText("20");
  await expect(card.locator("dl")).toContainText("30.0");
  await expect(card.locator("dl")).toContainText("40");
  await expect(card.locator("dl")).toContainText("10.0");
  await expect(card.getByText("Your score")).toHaveCount(0);
  await expect(card.locator("svg[role=img]").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0].gradingFinalized)).toBe(true);
});

test("'Not yet' on an exam stays on the grading page and announces nothing", async ({ page }) => {
  await seed(page, { exam: true });
  await page.goto(`${BASE}/teacher/courses/c-ar/assignments/as1/grading`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Finish & announce" }).first().click();
  await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Not yet" }).click();
  await expect(page).toHaveURL(/\/grading$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")[0].gradingFinalized)).toBeFalsy();
});

test("an exam that is not announced yet says so on its results page", async ({ page }) => {
  await seed(page, { exam: true });
  await page.goto(`${BASE}/teacher/courses/c-ar/assignments/as1/results`);
  await expect(page.getByRole("status")).toContainText("Not announced yet");
  await expect(page.locator("section").filter({ hasText: "Class statistics · 3 students" }).last()).toContainText("Not announced");
});

test("an ordinary assignment stays on the grading page after announcing, and its results page has no exam card", async ({ page }) => {
  await seed(page, { exam: false });
  await announce(page);
  await expect(page.getByText("Results announced")).toBeVisible();
  await expect(page).toHaveURL(/\/grading$/);
  await page.goto(`${BASE}/teacher/courses/c-ar/assignments/as1/results`);
  await expect(page.getByText("Class statistics")).toHaveCount(0);
});
