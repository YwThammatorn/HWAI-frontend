import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// Mirrors src/lib/featureFlags.ts — keep in sync. Announcements is hidden
// app-wide (15/9/2569, temporary).
const ANNOUNCEMENTS_DISABLED = true;

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

  test("not-submitted assignment shows Not submitted badge", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    // exact: true — the "Not submitted (N)" section heading also contains this substring
    await expect(page.getByText("Not submitted", { exact: true })).toBeVisible();
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

test.describe("P3b — Assignment status colours", () => {
  // Spec from the user (19/9/2569): soft orange / blue / green / red pairs.
  const EXPECTED = {
    "Not submitted": { bg: "rgb(255, 247, 237)", fg: "rgb(194, 65, 12)" },
    "Submitted": { bg: "rgb(240, 249, 255)", fg: "rgb(3, 105, 161)" },
    "Graded": { bg: "rgb(220, 252, 231)", fg: "rgb(21, 128, 61)" },
    "Overdue": { bg: "rgb(254, 226, 226)", fg: "rgb(185, 28, 28)" },
  } as const;

  test("list badges use the orange / blue / green / red status colours", async ({ page }) => {
    await seedStudent(page);
    const mk = (id: string, name: string, dueDate: string) => ({ ...ASSIGNMENT_OPEN, id, name, dueDate });
    await page.addInitScript((data) => {
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(data.assignments));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
    }, {
      assignments: [
        mk("s-todo", "Todo work", "2099-12-31"),
        mk("s-sent", "Sent work", "2099-12-31"),
        mk("s-graded", "Graded work", "2099-12-31"),
        mk("s-late", "Late work", "2026-01-15"),
      ],
      submissions: [
        { ...SUBMISSION_GRADED, id: "sub-sent", assignmentId: "s-sent", status: "need_review", instructorScore: null, aiScore: null },
        { ...SUBMISSION_GRADED, id: "sub-graded", assignmentId: "s-graded" },
      ],
    });
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");

    for (const [label, want] of Object.entries(EXPECTED)) {
      const badge = page.locator("a span.rounded-full", { hasText: new RegExp(`^${label}$`) }).first();
      await expect(badge, label).toBeVisible();
      const css = await badge.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, fg: c.color }; });
      expect(css, label).toEqual(want);
    }
  });

  test("detail page panels follow the same palette (graded = green, to-do = orange, overdue = red)", async ({ page }) => {
    await seedStudent(page, { submissions: [SUBMISSION_GRADED] });
    await page.addInitScript((a) => {
      const list = JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]");
      if (!list.some((x: { id: string }) => x.id === a.id)) localStorage.setItem("hwai_assignments_v1", JSON.stringify([...list, a]));
    }, { ...ASSIGNMENT_OPEN, id: "a-past", name: "Past due work", dueDate: "2026-01-15" });
    const colours = (loc: ReturnType<Page["locator"]>) =>
      loc.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, fg: c.color }; });

    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-graded`);
    await page.waitForLoadState("networkidle");
    expect(await colours(page.locator("div.rounded-xl", { has: page.getByText("Graded", { exact: true }) }).first())).toEqual(EXPECTED.Graded);

    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    expect(await colours(page.locator("div.rounded-xl", { has: page.getByText("Not submitted yet") }).first())).toEqual(EXPECTED["Not submitted"]);

    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-past`);
    await page.waitForLoadState("networkidle");
    expect(await colours(page.locator("div.rounded-xl", { has: page.getByText("Not submitted yet") }).first())).toEqual(EXPECTED.Overdue);
  });
});

test.describe("P3b — Classwork list layout", () => {
  test("assignments in a group stack top-to-bottom, one per row (not side by side)", async ({ page }) => {
    await seedStudent(page);
    // Override with three not-yet-submitted assignments so they land in the same group
    await page.addInitScript((list) => {
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(list));
    }, ["a1", "a2", "a3"].map((k, i) => ({
      ...ASSIGNMENT_OPEN, id: `a-stack-${k}`, name: `Stack ${i + 1}`, dueDate: "2099-12-31",
    })));
    await page.setViewportSize({ width: 1600, height: 900 }); // wide enough that the old xl two-column grid would kick in
    await page.goto(`${BASE}/student/courses/c-p3/classwork`);
    await page.waitForLoadState("networkidle");
    const boxes = await Promise.all([1, 2, 3].map((n) => page.getByText(`Stack ${n}`).first().boundingBox()));
    for (const b of boxes) expect(b).not.toBeNull();
    // same left edge and strictly increasing top => one column
    expect(new Set(boxes.map((b) => Math.round(b!.x))).size).toBe(1);
    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y);
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
    await page.getByPlaceholder(/figma/i).fill("https://figma.com/file/test");
    await page.getByRole("button", { name: /ส่งงาน|Submit/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/ยืนยันการส่งงาน|Confirm submission/i);
  });

  test("Cancel in confirm dialog closes it without submitting", async ({ page }) => {
    await seedStudent(page);
    await page.goto(`${BASE}/student/courses/c-p3/classwork/a-open`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder(/figma/i).fill("https://figma.com/file/test");
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
    await page.getByPlaceholder(/figma/i).fill("https://figma.com/file/test");
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
    test.skip(ANNOUNCEMENTS_DISABLED, "Announcements is hidden app-wide until ANNOUNCEMENTS_DISABLED is flipped back to false");
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
