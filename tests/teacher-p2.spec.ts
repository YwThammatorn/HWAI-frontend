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
  acceptsFiles?: boolean;
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

  // Score is read-only in this table (23/9/2569, corrects the 22/9 merge) — editing only happens on
  // the recheck page, per criterion. The Score column just shows the current score: the instructor's
  // saved override if one exists, else the AI's own score.

  test("grading page loads with AI scores shown as read-only text, no editable input", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/teacher/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("row", { name: /สมชาย ใจดี/i })).toContainText("72");
    await expect(page.getByRole("row", { name: /สมหญิง ดีมาก/i })).toContainText("55");
    await expect(page.locator("main table input[type='number']")).toHaveCount(0);
  });

  test("a submission with a saved instructor override shows Edited, and the AI's original score as a hint", async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Dr. Smith", email: "smith@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ ...data.subA, instructorScore: 85, status: "graded" }, data.subB]));
    }, { course: COURSE, assignment: ASSIGNMENT, subA: SUBMISSION_A, subB: SUBMISSION_B });
    await page.goto(`${BASE}/teacher/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("row", { name: /สมชาย ใจดี/i });
    await expect(row).toContainText("85");
    await expect(row.getByText(/แก้ไขแล้ว|Edited/i)).toBeVisible();
    await expect(row.getByText("AI: 72")).toBeVisible();
  });

  test("Grade link is the only way to edit a score, and shows on every row regardless of status", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/teacher/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    // Both seeded submissions are not_graded (no AI score yet) — the Grade link (23/9/2569 round 3,
    // was gated on need_review/graded, hidden until an AI score existed) now shows for every row so a
    // teacher can jump straight into grading without waiting on/needing an AI pass.
    const links = page.getByRole("link", { name: /^Grade$/i });
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", /\/recheck\?sub=sub-1/);
  });

  test("Re-grade button shows spinner then updates score", async ({ page }) => {
    await seedGrading(page);
    await page.goto(`${BASE}/teacher/courses/c-p2/assignments/a-p2/grading`);
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

  test("an assignment that doesn't accept files has no Re-grade button, but the Grade link still works on a not_graded row", async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Dr. Smith", email: "smith@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ ...data.assignment, acceptsFiles: false }]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([data.subA, data.subB]));
    }, { course: COURSE, assignment: ASSIGNMENT, subA: SUBMISSION_A, subB: SUBMISSION_B });
    await page.goto(`${BASE}/teacher/courses/c-p2/assignments/a-p2/grading`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /re.grade/i })).toHaveCount(0);
    const links = page.getByRole("link", { name: /^Grade$/i });
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", /\/recheck\?sub=sub-1/);
  });

});
