import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Student-formed teams for group assignments (15/9/2569) — teammates can only
// be picked from classmates enrolled in the same section, matching this
// session's constraint: "จับกลุ่มเพื่อนได้ จากเพื่อนที่เรียนอยู่ใน sec เดียวกันเท่านั้น".

const COURSE = {
  id: "c-p6", name: "Capstone Studio", description: "Group project course",
  status: "active", coverColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

// A second section of a different course — used to prove classmates outside
// this section never appear as pickable teammates.
const OTHER_COURSE = {
  id: "c-p6-other", name: "Other Course", description: "",
  status: "active", coverColor: "#F97316",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const ROSTER = [
  { id: "s-p6-1", courseId: "c-p6", studentId: "64070601", firstName: "Fah", lastName: "Test", email: "64070601@kmitl.ac.th", cohort: "CE69" },
  { id: "s-p6-2", courseId: "c-p6", studentId: "64070602", firstName: "Beam", lastName: "Suk", email: "64070602@kmitl.ac.th", cohort: "CE69" },
  { id: "s-p6-3", courseId: "c-p6", studentId: "64070603", firstName: "Ploy", lastName: "Wong", email: "64070603@kmitl.ac.th", cohort: "CE69" },
  // Enrolled in the OTHER course only — must never appear in the c-p6 picker.
  { id: "s-p6-4", courseId: "c-p6-other", studentId: "64070699", firstName: "Outsider", lastName: "Person", email: "64070699@kmitl.ac.th", cohort: "CE69" },
];

const GROUP_ASSIGNMENT = {
  id: "a-p6-1", courseId: "c-p6", name: "Team Prototype",
  description: "Build the prototype as a team", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "group", maxGroupSize: 2,
  acceptsFiles: true, fileTypes: [], rubricIds: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const SECOND_GROUP_ASSIGNMENT = {
  ...GROUP_ASSIGNMENT, id: "a-p6-2", name: "Team Final Report",
};

async function seed(page: Page, opts: {
  asStudentId?: string; assignments?: unknown[]; groups?: unknown[]; courses?: unknown[]; roster?: unknown[];
} = {}) {
  const {
    asStudentId = "64070601", assignments = [GROUP_ASSIGNMENT], groups = [],
    courses = [COURSE, OTHER_COURSE], roster = ROSTER,
  } = opts;
  const me = roster.find((s) => (s as { studentId: string }).studentId === asStudentId) as
    { firstName: string; lastName: string; email: string } | undefined;
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({
      name: data.name, email: data.email, role: "student", studentId: data.studentId,
    }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(data.courses));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(data.assignments));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([]));
    localStorage.setItem("hwai_student_groups_v1", JSON.stringify(data.groups));
  }, {
    name: me ? `${me.firstName} ${me.lastName}` : "Fah Test",
    email: me?.email ?? "64070601@kmitl.ac.th",
    studentId: asStudentId, courses, roster, assignments, groups,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P6 — Group assignment: before joining a team", () => {
  test("shows a 'form a team' empty state and disables submit", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-1`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/haven't joined a team yet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^submit$/i })).toBeDisabled();
  });
});

test.describe("P6 — Team picker: same-section only", () => {
  test("lists only classmates enrolled in this section, never another course's roster", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-1`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /form a team/i }).click();
    await expect(page.getByText("Beam Suk")).toBeVisible();
    await expect(page.getByText("Ploy Wong")).toBeVisible();
    await expect(page.getByText("Outsider Person")).not.toBeVisible();
  });

  test("a classmate already on a team for this assignment is shown as unavailable", async ({ page }) => {
    const existingGroup = {
      id: "sg-p6-1", assignmentId: "a-p6-1", courseId: "c-p6", name: "Early Birds",
      memberStudentIds: ["64070602", "64070603"],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await seed(page, { groups: [existingGroup] });
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-1`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /form a team/i }).click();
    await expect(page.getByText("already in a team")).toHaveCount(2);
    const beamCheckbox = page.locator("label", { hasText: "Beam Suk" }).locator("input[type=checkbox]");
    await expect(beamCheckbox).toBeDisabled();
  });
});

test.describe("P6 — Forming and sharing a team", () => {
  test("creating a team enables submit, and a teammate sees the same team without creating it", async ({ page }) => {
    await seed(page);
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-1`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /form a team/i }).click();
    await page.getByPlaceholder(/team alpha/i).fill("Prototype Pals");
    await page.getByText("Beam Suk").click();
    await page.getByRole("button", { name: /create team/i }).click();

    await expect(page.getByText("Prototype Pals")).toBeVisible();
    await expect(page.getByRole("button", { name: /^submit$/i })).toBeEnabled();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_student_groups_v1") ?? "[]"));
    expect(stored).toHaveLength(1);
    expect(stored[0].memberStudentIds.sort()).toEqual(["64070601", "64070602"]);
  });

  test("submitting creates a shared submission for every team member", async ({ page }) => {
    const existingGroup = {
      id: "sg-p6-2", assignmentId: "a-p6-1", courseId: "c-p6", name: "Prototype Pals",
      memberStudentIds: ["64070601", "64070602"],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await seed(page, { groups: [existingGroup] });
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-1`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^submit$/i }).click();
    await page.getByRole("button", { name: /confirm.*submit/i }).click();
    await expect(page.getByText(/awaiting grade/i)).toBeVisible();

    const subs = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]"));
    expect(subs).toHaveLength(2);
    const studentIds = subs.map((s: { studentId: string }) => s.studentId).sort();
    expect(studentIds).toEqual(["64070601", "64070602"]);
    expect(subs[0].groupId).toBe(subs[1].groupId);
  });
});

test.describe("P6 — Reuse a previous team", () => {
  test("offers a past team from the same course as a one-click preset", async ({ page }) => {
    const pastGroup = {
      id: "sg-p6-3", assignmentId: "a-p6-1", courseId: "c-p6", name: "Prototype Pals",
      memberStudentIds: ["64070601", "64070602"],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await seed(page, { assignments: [GROUP_ASSIGNMENT, SECOND_GROUP_ASSIGNMENT], groups: [pastGroup] });
    await page.goto(`${BASE}/student/courses/c-p6/classwork/a-p6-2`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /form a team/i }).click();
    await expect(page.getByText("Reuse a previous team")).toBeVisible();
    await page.getByText("Prototype Pals").click();
    const beamCheckbox = page.locator("label", { hasText: "Beam Suk" }).locator("input[type=checkbox]");
    await expect(beamCheckbox).toBeChecked();
  });
});
