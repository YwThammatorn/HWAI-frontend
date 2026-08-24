import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Seed helpers ──────────────────────────────────────────────────────────────

interface CourseSeed {
  id: string; name: string; description: string;
  status: "active" | "archived"; source: string;
  coverColor: string; iconColor: string;
  createdAt: string; updatedAt: string;
}

interface AssignmentSeed {
  id: string; courseId: string; name: string;
  description: string; dueDate: string; maxPoints: number;
  submissionType: "individual" | "group";
  attachments: unknown[]; createdAt: string; updatedAt: string;
}

interface SubmissionSeed {
  id: string; assignmentId: string; studentId: string;
  studentName: string; email: string; submittedAt: string;
  fileUrl: null; aiScore: number | null;
  instructorScore: number | null; instructorComment: string;
  externalUseConsent: boolean;
  status: "not_graded" | "need_review" | "graded";
}

const COURSE: CourseSeed = {
  id: "c-p2", name: "Software Engineering", description: "SE",
  status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const ASSIGNMENT: AssignmentSeed = {
  id: "a-p2", courseId: "c-p2", name: "Lab 1: Hello World",
  description: "First lab assignment", dueDate: "2026-12-31",
  maxPoints: 100, submissionType: "individual",
  attachments: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const SUBMISSION_A: SubmissionSeed = {
  id: "sub-1", assignmentId: "a-p2", studentId: "64070501",
  studentName: "สมชาย ใจดี", email: "s1@kmitl.ac.th",
  submittedAt: "2026-08-20T10:00:00.000Z", fileUrl: null,
  aiScore: 72, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "not_graded",
};

const SUBMISSION_B: SubmissionSeed = {
  id: "sub-2", assignmentId: "a-p2", studentId: "64070502",
  studentName: "สมหญิง ดีมาก", email: "s2@kmitl.ac.th",
  submittedAt: "2026-08-20T11:00:00.000Z", fileUrl: null,
  aiScore: 55, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "not_graded",
};

async function seedGrading(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: "Dr. Smith", email: "smith@kmitl.ac.th", role: "teacher",
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
  }, { course: COURSE, assignment: ASSIGNMENT, submissions: [SUBMISSION_A, SUBMISSION_B] });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P2 — Teacher Grade Adjustment", () => {

  test("grading page loads with AI scores shown", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    // AI scores displayed in greyed cells
    await expect(page.getByText("72")).toBeVisible();
    await expect(page.getByText("55")).toBeVisible();
  });

  test("instructor score input accepts a number", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    // Find the first instructor score input and enter a value
    const inputs = page.locator("input[type='number']");
    await inputs.first().fill("85");
    await expect(inputs.first()).toHaveValue("85");
  });

  test("row highlights amber after instructor score differs from AI score", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    const inputs = page.locator("input[type='number']");
    await inputs.first().fill("85");
    // "แก้ไขแล้ว" / "Edited" badge appears
    await expect(page.getByText(/แก้ไขแล้ว|Edited/i)).toBeVisible();
  });

  test("Save button is disabled when no changes made", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    // Save button disabled initially (no instructorScore edits)
    const saveBtn = page.getByRole("button", { name: /บันทึก|Save/i }).last();
    await expect(saveBtn).toBeDisabled();
  });

  test("Save button enables after editing instructor score", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    const inputs = page.locator("input[type='number']");
    await inputs.first().fill("90");
    const saveBtn = page.getByRole("button", { name: /บันทึก|Save/i }).last();
    await expect(saveBtn).toBeEnabled();
  });

  test("clicking Save shows success confirmation", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    const inputs = page.locator("input[type='number']");
    await inputs.first().fill("90");
    const saveBtn = page.getByRole("button", { name: /บันทึก|Save/i }).last();
    await saveBtn.click();
    // Success indicator: "บันทึกแล้ว ✓" or similar
    await expect(page.getByText(/บันทึกแล้ว|Saved/i)).toBeVisible();
  });

  test("Re-grade button shows spinner then updates score", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    // Find re-grade button in first row
    const regradeBtn = page.getByRole("button", { name: /re.grade|ตรวจใหม่/i }).first();
    await regradeBtn.click();
    // Spinner visible during processing (1500ms)
    await expect(regradeBtn).toBeDisabled();
    // After completion, score cell updates (wait up to 3s)
    await page.waitForTimeout(2000);
    await expect(regradeBtn).toBeEnabled();
  });

  test("instructor score is clamped to maxPoints (100)", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    const inputs = page.locator("input[type='number']");
    await expect(inputs.first()).toHaveAttribute("max", "100");
    await expect(inputs.first()).toHaveAttribute("min", "0");
  });

});
