import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COURSE = {
  id: "c-p3", name: "Data Structures", description: "DS course",
  status: "active", source: "manual", coverColor: "#F97316", iconColor: "#F97316",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const ASSIGNMENT_OPEN = {
  id: "a-open", courseId: "c-p3", name: "Lab 1: Arrays",
  description: "Implement basic array operations", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "individual",
  attachments: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const ASSIGNMENT_GRADED = {
  id: "a-graded", courseId: "c-p3", name: "Lab 0: Setup",
  description: "Install dev tools", dueDate: "2026-01-15",
  maxPoints: 10, submissionType: "individual",
  attachments: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const STUDENT_RECORD = {
  id: "sr-1", courseId: "c-p3", studentId: "64070501",
  firstName: "สมชาย", lastName: "ใจดี", email: "s1@kmitl.ac.th", cohort: "CE69",
};

const SUBMISSION_GRADED = {
  id: "sub-graded", assignmentId: "a-graded", studentId: "64070501",
  studentName: "สมชาย ใจดี", email: "s1@kmitl.ac.th",
  submittedAt: "2026-01-10T10:00:00.000Z", fileUrl: null,
  aiScore: 9, instructorScore: 10, instructorComment: "งานดีมาก ส่งทัน",
  externalUseConsent: false, status: "graded",
};

const COHORT_STUDENT = {
  id: "cs-1", studentId: "64070501", firstName: "สมชาย", lastName: "ใจดี",
  email: "s1@kmitl.ac.th", cohort: "CE69", program: "CE",
};

async function seedStudent(page: Page, opts: { submissions?: unknown[] } = {}) {
  const { submissions = [] } = opts;
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: "สมชาย ใจดี", email: "s1@kmitl.ac.th",
      role: "student", studentId: "64070501",
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(data.assignments));
    localStorage.setItem("hwai_students_v1", JSON.stringify([data.studentRecord]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([data.cohortStudent]));
    if (data.submissions.length > 0)
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
  }, {
    course: COURSE,
    assignments: [ASSIGNMENT_OPEN, ASSIGNMENT_GRADED],
    studentRecord: STUDENT_RECORD,
    cohortStudent: COHORT_STUDENT,
    submissions,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P3a — Student Course List (/student/courses)", () => {

  test("enrolled course card appears on course list", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Data Structures")).toBeVisible();
  });

  test("course card links to classwork page", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Data Structures").click();
    await expect(page).toHaveURL(/\/student\/courses\/c-p3\/classwork/);
  });

});

test.describe("P3b — Student Classwork List (/student/courses/[secId]/classwork)", () => {

  test("classwork list shows assignments for enrolled course", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Lab 1: Arrays")).toBeVisible();
    await expect(page.getByText("Lab 0: Setup")).toBeVisible();
  });

  test("not-submitted assignment shows blue badge", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Not submitted")).toBeVisible();
  });

  test("graded assignment shows Graded badge", async ({ page }) => {
    await seedStudent(page, { submissions: [SUBMISSION_GRADED] });
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Graded")).toBeVisible();
  });

  test("graded assignment shows score in card", async ({ page }) => {
    await seedStudent(page, { submissions: [SUBMISSION_GRADED] });
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    // Score cell: "10/10" or similar
    await expect(page.getByText(/10\/10|10\s*\/\s*10/)).toBeVisible();
  });

  test("assignment card links to detail page", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    await page.getByText("Lab 1: Arrays").click();
    await expect(page).toHaveURL(/\/student\/courses\/c-p3\/classwork\/a-open/);
  });

});

test.describe("P3b — Student Classwork Detail + Submit", () => {

  test("detail page shows assignment name and maxPoints", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lab 1: Arrays");
    await expect(page.getByText(/Max 100|คะแนนเต็ม 100/)).toBeVisible();
  });

  test("not-submitted state shows placeholder in work panel", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/ยังไม่ได้ส่งงาน|Not submitted yet/)).toBeVisible();
  });

  test("Submit button is visible for unsubmitted open assignment", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /ส่งงาน|Submit/ })).toBeVisible();
  });

  test("clicking Submit opens confirm dialog", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /ส่งงาน|Submit/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/ยืนยันการส่งงาน|Confirm submission/i);
  });

  test("Cancel in confirm dialog closes it without submitting", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /ส่งงาน|Submit/ }).click();
    await page.getByRole("button", { name: /ยกเลิก|Cancel/ }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    // Still shows not-submitted state
    await expect(page.getByText(/ยังไม่ได้ส่งงาน|Not submitted yet/)).toBeVisible();
  });

  test("confirming submit shows 'submitted awaiting grade' state", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /ส่งงาน|Submit/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /ยืนยัน|Confirm/i }).click();
    // Post-submit state
    await expect(page.getByText(/ส่งแล้ว รอผล|Submitted.*awaiting/i)).toBeVisible();
    // Submit button label changes to Resubmit
    await expect(page.getByRole("button", { name: /ส่งอีกครั้ง|Resubmit/i })).toBeVisible();
  });

  test("graded assignment shows score and instructor comment", async ({ page }) => {
    await seedStudent(page, { submissions: [SUBMISSION_GRADED] });
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-graded`);
    await page.waitForLoadState("networkidle");
    // Score display — "Graded" badge and score value both visible
    await expect(page.getByText(/ตรวจแล้ว|Graded/i).first()).toBeVisible();
    await expect(page.getByText(/^10$|^10\//).first()).toBeVisible();
    // Instructor comment
    await expect(page.getByText("งานดีมาก ส่งทัน")).toBeVisible();
  });

  test("graded assignment does not show submit button", async ({ page }) => {
    await seedStudent(page, { submissions: [SUBMISSION_GRADED] });
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-graded`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /ส่งงาน|Submit|ส่งอีกครั้ง|Resubmit/i })).not.toBeVisible();
  });

});

test.describe("P3c — Student Announcements + Evaluation Stubs", () => {

  test("announcements page loads with empty state", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/announcements`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/ประกาศ|Announcements/i);
    await expect(page.getByText(/ยังไม่มีประกาศ|No announcements/i)).toBeVisible();
  });

  test("evaluation page loads with empty state", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/evaluation`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/ผลการประเมิน|Evaluation/i);
    await expect(page.getByText(/ยังไม่มีผล|No evaluation/i)).toBeVisible();
  });

});

test.describe("P3 — Student Home (/student)", () => {

  test("student home shows enrolled course in quick links", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student`);
    await page.waitForLoadState("networkidle");
    // Target the courses section link specifically (has status badge text next to name)
    await expect(page.getByRole("link", { name: /Data Structures/ }).last()).toBeVisible();
  });

  test("student home shows upcoming assignments section", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/งานที่ต้องส่งเร็วๆ นี้|Upcoming assignments/i)).toBeVisible();
  });

});
