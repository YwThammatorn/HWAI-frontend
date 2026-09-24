import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// One continuous walk of the whole group-assignment feature (15/9/2569),
// spanning both roles through real UI actions only — no localStorage
// shortcuts for the parts under test (team formation, submit, grading).
// This is deliberately separate from student-p6-groups.spec.ts (team
// formation in isolation) and teacher-p5-group-grading.spec.ts (grading in
// isolation): those prove each page works; this proves the pieces actually
// connect end to end across a cold start.

const COURSE = {
  id: "c-e2e", name: "Interaction Design", description: "",
  status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const TEACHER = {
  id: "t-e2e", title: "อ.", name: "Walk Teacher", email: "walk-teacher@kmitl.ac.th",
  role: "teacher", status: "active", courseIds: ["c-e2e"],
};

const FAH = { name: "Fah Nueng", email: "64070801@kmitl.ac.th", role: "student", studentId: "64070801" };
const BEAM = { name: "Beam Song", email: "64070802@kmitl.ac.th", role: "student", studentId: "64070802" };

const ROSTER = [
  { id: "s-e2e-1", courseId: "c-e2e", studentId: "64070801", firstName: "Fah", lastName: "Nueng", email: "64070801@kmitl.ac.th", cohort: "CE69" },
  { id: "s-e2e-2", courseId: "c-e2e", studentId: "64070802", firstName: "Beam", lastName: "Song", email: "64070802@kmitl.ac.th", cohort: "CE69" },
  { id: "s-e2e-3", courseId: "c-e2e", studentId: "64070803", firstName: "Ploy", lastName: "Saam", email: "64070803@kmitl.ac.th", cohort: "CE69" },
];

const ASSIGNMENT = {
  id: "a-e2e", courseId: "c-e2e", name: "Team Poster", description: "Design a poster together",
  dueDate: "2099-12-31", maxPoints: 100, submissionType: "group", maxGroupSize: 2,
  acceptsFiles: true, fileTypes: [], rubricIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const CLASSWORK_URL = `${BASE}/student/courses/c-e2e/classwork/a-e2e`;
const GRADING_URL = `${BASE}/teacher/courses/c-e2e/assignments/a-e2e/grading`;

async function seedStatic(page: Page) {
  await page.addInitScript((data) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify([data.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([data.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(data.roster));
    // The assignment is seeded once too: the teacher's "Finish & announce" changes it (gradingFinalized)
    if (!localStorage.getItem("hwai_assignments_v1")) localStorage.setItem("hwai_assignments_v1", JSON.stringify([data.assignment]));
    // Only seed these if absent — addInitScript re-runs on every navigation
    // within the test, and a plain overwrite here would silently wipe out
    // the team/submission the test creates through real UI actions on a
    // later page.goto (see [[project-hwai-agent]] "addInitScript re-runs on
    // every navigation" lesson).
    if (!localStorage.getItem("hwai_submissions_v1")) localStorage.setItem("hwai_submissions_v1", "[]");
    if (!localStorage.getItem("hwai_student_groups_v1")) localStorage.setItem("hwai_student_groups_v1", "[]");
  }, { course: COURSE, teacher: TEACHER, roster: ROSTER, assignment: ASSIGNMENT });
}

async function loginAs(page: Page, user: { name: string; email: string; role: string; studentId?: string }) {
  await page.evaluate((u) => localStorage.setItem("hwai_user", JSON.stringify(u)), user);
}

test("cold start: a student forms a team, submits, the teacher grades once, and every teammate sees the result", async ({ page }) => {
  await seedStatic(page);

  // Establish the origin before logging in, then land on the assignment as Fah.
  await page.goto(BASE);
  await loginAs(page, FAH);
  await page.goto(CLASSWORK_URL);
  await page.waitForLoadState("networkidle");

  // Cold start: no team yet, submit is blocked.
  await expect(page.getByText(/haven't joined a team yet/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^submit$/i })).toBeDisabled();

  // Form a team with a real classmate from the roster.
  await page.getByRole("button", { name: /form a team/i }).click();
  await page.getByPlaceholder(/team alpha/i).fill("Poster Squad");
  await page.getByText("Beam Song").click();
  await page.getByRole("button", { name: /create team/i }).click();
  await expect(page.getByText("Poster Squad")).toBeVisible();
  await expect(page.getByText("2 of 2 spots filled")).toBeVisible();

  // Submit the team's work.
  await page.getByRole("button", { name: /^submit$/i }).click();
  await page.getByRole("button", { name: /confirm.*submit/i }).click();
  await expect(page.getByText(/awaiting grade/i)).toBeVisible();

  // Beam never touched the drawer or the submit button — she should still
  // see the shared team and submission the moment she opens the page.
  await loginAs(page, BEAM);
  await page.goto(CLASSWORK_URL);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Poster Squad")).toBeVisible();
  await expect(page.getByText(/awaiting grade/i)).toBeVisible();

  // Teacher grades the merged team row once. Score is read-only in the Grade Adjustment table
  // (23/9/2569) — grading a team happens via Re-grade (to get it out of "not graded" so Recheck
  // appears) then Recheck, where the actual score is set. This assignment has no rubric, so Recheck
  // falls back to a single "enter the total score directly" input (23/9/2569).
  await loginAs(page, { name: TEACHER.name, email: TEACHER.email, role: "teacher" });
  await page.goto(GRADING_URL);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Poster Squad")).toBeVisible();
  await page.getByRole("button", { name: /Re-grade team Poster Squad/i }).click();
  await page.waitForTimeout(2000); // mock re-grade takes 1.5s
  await page.getByRole("link", { name: /Grade team/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Total score/i).fill("88");
  await page.getByRole("button", { name: /Save Changes/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();

  // Graded is not announced yet: Beam still just sees "awaiting grade", no score.
  await loginAs(page, BEAM);
  await page.goto(CLASSWORK_URL);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/awaiting grade/i)).toBeVisible();
  await expect(page.getByText("88")).toHaveCount(0);

  // The teacher finishes grading and announces the results (confirm popup) …
  await loginAs(page, { name: TEACHER.name, email: TEACHER.email, role: "teacher" });
  await page.goto(GRADING_URL);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /finish & announce/i }).first().click();
  await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Announce results" }).click();
  await expect(page.getByText("Results announced")).toBeVisible();

  // … and only then does Beam — who was never graded directly — see the graded score.
  await loginAs(page, BEAM);
  await page.goto(CLASSWORK_URL);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Graded")).toBeVisible();
  await expect(page.getByText("88").first()).toBeVisible();

  // And the classwork list (a different page again) reflects it too.
  await page.goto(`${BASE}/student/courses/c-e2e/classwork`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("88/100")).toBeVisible();
  await expect(page.getByText("Graded")).toBeVisible();
});
