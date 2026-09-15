import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Teacher-side view of group assignments (15/9/2569): the submissions table
// merges rows by StudentGroup instead of listing every teammate separately,
// and grading the merged row (via RecheckPage) fans out to every member —
// see src/lib/studentGroups.ts and the assignment detail page.

const COURSE = {
  id: "c-tp5", name: "Capstone Studio", description: "Group project course",
  status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const TEACHER = {
  id: "t-tp5", title: "ผศ.ดร.", name: "Verify Teacher", email: "verify-tp5@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: ["c-tp5"],
};

const ROSTER = [
  { id: "s-tp5-1", courseId: "c-tp5", studentId: "64070701", firstName: "Fah", lastName: "Test", email: "64070701@kmitl.ac.th", cohort: "CE69" },
  { id: "s-tp5-2", courseId: "c-tp5", studentId: "64070702", firstName: "Beam", lastName: "Suk", email: "64070702@kmitl.ac.th", cohort: "CE69" },
  { id: "s-tp5-3", courseId: "c-tp5", studentId: "64070703", firstName: "Solo", lastName: "Student", email: "64070703@kmitl.ac.th", cohort: "CE69" },
];

const GROUP_ASSIGNMENT = {
  id: "a-tp5-1", courseId: "c-tp5", name: "Capstone Prototype",
  description: "Build the prototype as a team", dueDate: "2099-12-31",
  maxPoints: 100, submissionType: "group", maxGroupSize: 3,
  acceptsFiles: true, fileTypes: [], rubricIds: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const INDIVIDUAL_ASSIGNMENT = {
  ...GROUP_ASSIGNMENT, id: "a-tp5-2", name: "Solo Reflection", submissionType: "individual", maxGroupSize: null,
};

const TEAM = {
  id: "sg-tp5-1", assignmentId: "a-tp5-1", courseId: "c-tp5", name: "Prototype Pals",
  memberStudentIds: ["64070701", "64070702"],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

function teamSubmission(studentId: string, name: string, email: string, status: string) {
  return {
    id: `sub-tp5-${studentId}`, assignmentId: "a-tp5-1", studentId, studentName: name, email,
    submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null,
    aiScore: 88, instructorScore: null, instructorComment: "",
    externalUseConsent: false, status, groupId: "sg-tp5-1",
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

const SOLO_SUBMISSION = {
  id: "sub-tp5-solo", assignmentId: "a-tp5-1", studentId: "64070703", studentName: "Solo Student", email: "64070703@kmitl.ac.th",
  submittedAt: "2026-01-06T10:00:00.000Z", fileUrl: null,
  aiScore: null, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "not_graded",
  updatedAt: "2026-01-06T10:00:00.000Z",
};

const INDIVIDUAL_SUBMISSION = {
  id: "sub-tp5-ind", assignmentId: "a-tp5-2", studentId: "64070701", studentName: "Fah Test", email: "64070701@kmitl.ac.th",
  submittedAt: "2026-01-06T10:00:00.000Z", fileUrl: null,
  aiScore: 90, instructorScore: null, instructorComment: "",
  externalUseConsent: false, status: "need_review",
  updatedAt: "2026-01-06T10:00:00.000Z",
};

async function seedTeacher(page: Page, opts: { submissions?: unknown[]; groups?: unknown[] } = {}) {
  const {
    submissions = [teamSubmission("64070701", "Fah Test", "64070701@kmitl.ac.th", "graded"), teamSubmission("64070702", "Beam Suk", "64070702@kmitl.ac.th", "graded"), SOLO_SUBMISSION],
    groups = [TEAM],
  } = opts;
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Verify Teacher", email: "verify-tp5@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.groupAssignment, data.individualAssignment]));
    localStorage.setItem("hwai_student_groups_v1", JSON.stringify(data.groups));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(data.submissions));
  }, {
    course: COURSE, teacher: TEACHER, roster: ROSTER,
    groupAssignment: GROUP_ASSIGNMENT, individualAssignment: INDIVIDUAL_ASSIGNMENT,
    groups, submissions,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("P5 — Teacher submissions table: group assignments merge into team rows", () => {
  test("shows one row per team with every member's name, plus a separate row for an unteamed submission", async ({ page }) => {
    await seedTeacher(page);
    await page.goto(`${BASE}/teacher/courses/c-tp5/assignments/a-tp5-1`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Prototype Pals")).toBeVisible();
    await expect(page.getByText("Fah Test, Beam Suk")).toBeVisible();
    await expect(page.getByRole("link", { name: /recheck team/i })).toBeVisible();

    // Unteamed submission still gets its own row.
    await expect(page.getByText("Solo Student")).toBeVisible();

    // Footer counts rows (2: one team + one solo), not raw submissions (3).
    await expect(page.getByText(/Showing 1–2 of 2 team\(s\)/i)).toBeVisible();
  });

  test("a non-group assignment is unaffected — still one row per student", async ({ page }) => {
    await seedTeacher(page, { submissions: [INDIVIDUAL_SUBMISSION] });
    await page.goto(`${BASE}/teacher/courses/c-tp5/assignments/a-tp5-2`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Fah Test")).toBeVisible();
    await expect(page.getByRole("link", { name: /^review$/i })).toBeVisible();
    await expect(page.getByText(/Showing 1–1 of 1 submission/i)).toBeVisible();
  });
});

test.describe("P5 — Grading a team row grades every member", () => {
  test("saving a recheck for one teammate marks the whole team graded", async ({ page }) => {
    await seedTeacher(page, {
      submissions: [
        teamSubmission("64070701", "Fah Test", "64070701@kmitl.ac.th", "need_review"),
        teamSubmission("64070702", "Beam Suk", "64070702@kmitl.ac.th", "need_review"),
        SOLO_SUBMISSION,
      ],
    });
    await page.goto(`${BASE}/teacher/courses/c-tp5/assignments/a-tp5-1/recheck?sub=sub-tp5-64070701`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Team Prototype Pals/i)).toBeVisible();
    await page.getByRole("button", { name: /save changes/i }).click();

    const subs = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]"));
    const teamSubs = subs.filter((s: { groupId?: string }) => s.groupId === "sg-tp5-1");
    expect(teamSubs).toHaveLength(2);
    expect(teamSubs.every((s: { status: string }) => s.status === "graded")).toBe(true);
  });
});

function gradedTeamSubmission(studentId: string, name: string, email: string, score: number) {
  return {
    id: `sub-tp5-${studentId}`, assignmentId: "a-tp5-1", studentId, studentName: name, email,
    submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null,
    aiScore: score, instructorScore: score, instructorComment: "",
    externalUseConsent: false, status: "graded", groupId: "sg-tp5-1",
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

test.describe("P5 — Results page merges by team", () => {
  test("shows one row per team and averages by team, not by raw submission count", async ({ page }) => {
    await seedTeacher(page, {
      submissions: [
        gradedTeamSubmission("64070701", "Fah Test", "64070701@kmitl.ac.th", 90),
        gradedTeamSubmission("64070702", "Beam Suk", "64070702@kmitl.ac.th", 90),
        SOLO_SUBMISSION,
      ],
    });
    await page.goto(`${BASE}/teacher/courses/c-tp5/assignments/a-tp5-1/results`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Prototype Pals").first()).toBeVisible();
    await expect(page.getByText("Fah Test, Beam Suk")).toBeVisible();
    // Average of [90] (the one graded team, counted once) is 90.0 — not
    // averaged as if two separate 90s were two separate data points, which
    // happens to compute the same here but the team-count stat proves the
    // dedup: 2 teams total (Prototype Pals + Solo Student), not 3 submissions.
    await expect(page.getByText(/2 team\(s\)/i)).toBeVisible();
    await expect(page.getByText("90.0")).toBeVisible();
  });
});

test.describe("P5 — Grade Adjustment table merges by team", () => {
  test("entering an instructor score for a team row fans out to every member on save", async ({ page }) => {
    await seedTeacher(page, {
      submissions: [
        teamSubmission("64070701", "Fah Test", "64070701@kmitl.ac.th", "not_graded"),
        teamSubmission("64070702", "Beam Suk", "64070702@kmitl.ac.th", "not_graded"),
        SOLO_SUBMISSION,
      ],
    });
    await page.goto(`${BASE}/teacher/courses/c-tp5/assignments/a-tp5-1/grading`);
    await page.waitForLoadState("networkidle");
    // 3 raw submissions collapse to 2 rows: the team (2 members) + the solo student.
    await expect(page.getByText(/2 row\(s\)/i)).toBeVisible();

    await page.getByLabel(/Instructor score for team Prototype Pals/i).fill("95");
    await page.getByRole("button", { name: /save/i }).click();

    const subs = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]"));
    const teamSubs = subs.filter((s: { groupId?: string }) => s.groupId === "sg-tp5-1");
    expect(teamSubs).toHaveLength(2);
    expect(teamSubs.every((s: { instructorScore: number; status: string }) => s.instructorScore === 95 && s.status === "graded")).toBe(true);
    // Untouched solo submission stays as-is.
    const solo = subs.find((s: { id: string }) => s.id === "sub-tp5-solo");
    expect(solo.status).toBe("not_graded");
  });
});
