import { test, expect, Page } from "@playwright/test";
import { BASE } from "./base";
import { taPathAllowed } from "../src/lib/taPaths";
import { isEnrolledInSubjectThatTerm, taCourseIdsFor } from "../src/lib/taRules";

// 10/11/2569 — the TA role. A TA is a STUDENT the teacher appointed on a course's Collaborators page. Signed in with their own student account they
// get a Student ↔ TA switch in the navbar; on the TA hat they see My Courses (only the courses they assist), and in each: Overview, Assignments
// (read-only), Grading, Score Book (view only, no export) and Students (read-only). They give and change scores; they do not use the AI, edit
// rubrics / assignments / the roster, announce, or export. Rule: a TA must not be enrolled in that subject in that term.
// All ids below are made up; no real student id belongs in this file.

const NOW = "2026-01-01T00:00:00.000Z";
const course = (id: string, name: string, template: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: "A course", status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: template,
  term: 1, academicYear: 2569, sectionNumber: "1", code: `0107${template.length}${id.length}`, schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW, ...extra,
});
const COURSES = [
  course("c-ta-a", "UX Course", "ct-ux"),
  course("c-ta-a2", "UX Course section 2", "ct-ux", { sectionNumber: "2" }),     // another section of the same subject, same term
  course("c-ta-b", "Databases", "ct-db"),
];
const person = (studentId: string, firstName: string) => ({ id: `cs-${studentId}`, studentId, firstName, lastName: "Test", email: `${studentId}@kmitl.ac.th`, program: "CE", status: "active" });
const TA = person("66000099", "Tia");            // the TA
const ENR = person("66000098", "Enr");           // appointed too, but enrolled in the subject this term
const SECOND = person("66000097", "Sec");        // enrolled in the OTHER section of the same subject
const CLASSMATES = [person("69000001", "Ann"), person("69000002", "Ben"), person("69000003", "Cat")];
const roster = (courseId: string, who: { studentId: string; firstName: string; lastName: string; email: string }[]) =>
  who.map((p, i) => ({ id: `r-${courseId}-${p.studentId}`, courseId, studentId: p.studentId, firstName: p.firstName, lastName: p.lastName, email: p.email, sequenceNumber: i + 1, enrollmentStatus: "enrolled" }));
const ROSTER = [
  ...roster("c-ta-a", [...CLASSMATES, ENR]),
  ...roster("c-ta-a2", [SECOND]),
  ...roster("c-ta-b", [TA, CLASSMATES[0]]),       // the TA is a plain student of Databases
];
const TEACHER = { id: "t-ta", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-ta-a", "c-ta-a2", "c-ta-b"] };
const ASSIGN = (id: string, courseId: string, name: string) => ({
  id, courseId, name, description: `${name} brief`, dueDate: "2026-01-05", maxPoints: 100, acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual",
  maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW,
});
const ASSIGNMENTS = [ASSIGN("a-q", "c-ta-a", "Quiz"), ASSIGN("a-b", "c-ta-b", "DB Lab")];
const sub = (id: string, assignmentId: string, p: { studentId: string; firstName: string }, status: string, score: number | null) => ({
  id, assignmentId, studentId: p.studentId, studentName: `${p.firstName} Test`, email: `${p.studentId}@kmitl.ac.th`, submittedAt: "2026-01-04T10:00:00.000Z", fileUrl: null,
  aiScore: score, instructorScore: status === "graded" ? score : null, instructorComment: "", externalUseConsent: false, status, updatedAt: NOW,
});
const SUBMISSIONS = [
  sub("sub-1", "a-q", CLASSMATES[0], "graded", 80), sub("sub-2", "a-q", CLASSMATES[1], "need_review", 60), sub("sub-3", "a-q", CLASSMATES[2], "not_graded", null),
];
const ROLES = [
  { id: "sr-1", accountId: TA.id, courseId: "c-ta-a", role: "ta" },
  { id: "sr-2", accountId: ENR.id, courseId: "c-ta-a", role: "ta" },
];

type Who = { studentId: string; hat: "student" | "ta" };
async function seed(page: Page, who: Who | null = { studentId: TA.studentId, hat: "student" }) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("ta_seeded")) return;
    sessionStorage.setItem("ta_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    if (d.who) localStorage.setItem("hwai_user", JSON.stringify({ name: "Someone", email: `${d.who.studentId}@kmitl.ac.th`, role: d.who.hat, studentId: d.who.studentId }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify(d.courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(d.cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", "[]");
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", "[]");
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.submissions));
    localStorage.setItem("hwai_section_roles_v1", JSON.stringify(d.roles));
  }, { who, courses: COURSES, teacher: TEACHER, cohort: [TA, ENR, SECOND, ...CLASSMATES], roster: ROSTER, assignments: ASSIGNMENTS, submissions: SUBMISSIONS, roles: ROLES });
}
const go = async (page: Page, url: string) => { await page.goto(`${BASE}${url}`); await page.waitForLoadState("networkidle"); };
const asTa = async (page: Page, url = "/teacher/courses") => { await seed(page, { studentId: TA.studentId, hat: "ta" }); await go(page, url); };
const A = "/teacher/courses/c-ta-a";

test.describe("the TA's rules (pure)", () => {
  const courses = COURSES as never[];
  const students = ROSTER as never[];
  test("a TA must not be enrolled in that subject in that term — any section of it counts; another subject or a withdrawn student does not", () => {
    expect(isEnrolledInSubjectThatTerm(ENR.studentId, COURSES[0] as never, courses, students)).toBe(true);        // this section
    expect(isEnrolledInSubjectThatTerm(SECOND.studentId, COURSES[0] as never, courses, students)).toBe(true);     // the other section of the same subject
    expect(isEnrolledInSubjectThatTerm(TA.studentId, COURSES[0] as never, courses, students)).toBe(false);        // enrolled only in Databases
    const left = students.map((s: { studentId: string }) => (s.studentId === ENR.studentId ? { ...s, enrollmentStatus: "withdrawn" } : s)) as never[];
    expect(isEnrolledInSubjectThatTerm(ENR.studentId, COURSES[0] as never, courses, left)).toBe(false);
    const nextTerm = [{ ...COURSES[0], term: 2 }, COURSES[1], COURSES[2]] as never[];
    expect(isEnrolledInSubjectThatTerm(SECOND.studentId, nextTerm[0], nextTerm, students)).toBe(false);            // same subject, another term
  });
  test("the TA's courses are the appointed ones where they are not enrolled", () => {
    expect([...taCourseIdsFor(ROLES as never[], TA.studentId, courses, students)]).toEqual(["c-ta-a"]);
    expect([...taCourseIdsFor(ROLES as never[], ENR.studentId, courses, students)]).toEqual([]);
    expect([...taCourseIdsFor([{ id: "x", accountId: "cs-x", courseId: "c-ta-a", role: "co-teacher" }] as never[], "66000001", courses, students)]).toEqual([]);   // only the ta role counts
  });
  test("which pages a TA may open: the five course pages and the Grade screen; not editing, rubrics, calibration, collaborators, settings or new", () => {
    for (const p of ["/teacher/courses", "/teacher/courses/c1", "/teacher/courses/c1/assignments", "/teacher/courses/c1/assignments/a1", "/teacher/courses/c1/assignments/a1/grading",
      "/teacher/courses/c1/assignments/a1/recheck", "/teacher/courses/c1/assignments/a1/results", "/teacher/courses/c1/grading", "/teacher/courses/c1/results", "/teacher/courses/c1/students"]) {
      expect(taPathAllowed(p).allowed, p).toBe(true);
    }
    expect(taPathAllowed("/teacher/courses/c9/grading")).toEqual({ allowed: true, courseId: "c9" });
    for (const p of ["/teacher/courses/new", "/teacher/courses/c1/assignments/new", "/teacher/courses/c1/assignments/a1/edit", "/teacher/courses/c1/rubrics", "/teacher/courses/c1/calibration",
      "/teacher/courses/c1/clo", "/teacher/courses/c1/collaborators", "/teacher/courses/c1/settings", "/teacher/courses/c1/announcements", "/teacher/courses/c1/materials",
      "/teacher/courses/c1/weekly-plan", "/teacher/courses/c1/grading-split", "/teacher/notifications", "/teacher/history", "/admin"]) {
      expect(taPathAllowed(p).allowed, p).toBe(false);
    }
  });
});

test.describe("the TA hat — getting in", () => {
  test("a student with a TA appointment gets a Student ↔ TA switch; a student without one does not", async ({ page }) => {
    await seed(page);
    await go(page, "/student");
    await expect(page.getByTestId("hat-switch")).toBeVisible();
  });

  test("no switch for a student with no appointment, nor for one who is enrolled in that subject this term", async ({ page }) => {
    await seed(page, { studentId: CLASSMATES[0].studentId, hat: "student" });
    await go(page, "/student");
    await expect(page.getByTestId("hat-switch")).toHaveCount(0);
  });

  test("an appointed student who is enrolled in the subject this term gets no TA hat", async ({ page }) => {
    await seed(page, { studentId: ENR.studentId, hat: "student" });
    await go(page, "/student");
    await expect(page.getByTestId("hat-switch")).toHaveCount(0);
  });

  test("the switch puts the TA hat on (My Courses lists only the course they assist) and takes it off again", async ({ page }) => {
    await seed(page);
    await go(page, "/student");
    await page.getByTestId("hat-switch").click();
    await page.getByRole("menuitemradio", { name: /TA/ }).click();
    await expect(page).toHaveURL(/\/teacher\/courses$/);
    await expect(page.getByTestId("ta-note")).toBeVisible();
    await expect(page.getByRole("link", { name: /UX Course/ })).toBeVisible();
    await expect(page.getByText("Databases")).toHaveCount(0);                      // a course they only attend as a student
    await page.getByTestId("hat-switch").click();
    await page.getByRole("menuitemradio", { name: /Student/ }).click();
    await expect(page).toHaveURL(/\/student/);
  });

  test("a TA hat that is stored but no longer has an appointment falls back to the student hat", async ({ page }) => {
    await seed(page, { studentId: CLASSMATES[0].studentId, hat: "ta" });
    await go(page, "/teacher/courses");
    await expect(page).toHaveURL(/\/student/);
  });
});

test.describe("what a TA sees and may do", () => {
  test("the course menu is Overview · Assignments · Grading · Score Book · Students", async ({ page }) => {
    await asTa(page, A);
    const nav = page.getByRole("navigation", { name: "UX Course" });
    await expect(nav.getByRole("link")).toHaveText(["Overview", "Assignments", "Grading", "Score Book", "Students"]);
  });

  test("pages that are not a TA's send them back to My Courses: edit, new, rubrics, calibration, collaborators, settings — and a course they do not assist", async ({ page }) => {
    await asTa(page, A);
    for (const url of [`${A}/assignments/a-q/edit`, `${A}/assignments/new`, `${A}/rubrics`, `${A}/calibration`, `${A}/collaborators`, `${A}/settings`, "/teacher/courses/c-ta-b/grading", "/teacher/courses/c-ta-b"]) {
      await go(page, url);
      await expect(page, url).toHaveURL(/\/teacher\/courses$/);
      await go(page, A);                                   // back inside the allowed course before the next one
    }
  });

  test("the course Grading page has one Grade link per assignment — no Grade with AI, no choice of method", async ({ page }) => {
    await asTa(page, `${A}/grading`);
    const card = page.locator("main li", { hasText: "Quiz" });
    await expect(card.getByTestId("ta-grade")).toHaveAttribute("href", `${A}/assignments/a-q/grading`);
    await expect(page.getByRole("button", { name: /Grade with AI|Grade manually/ })).toHaveCount(0);
  });

  test("an assignment's Grading page: Grade, Grade next and the list stay; Edit, Calibrate AI, Announce and Re-grade are gone", async ({ page }) => {
    await asTa(page, `${A}/assignments/a-q/grading`);
    await expect(page.getByTestId("grade-next")).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Edit Assignment" })).toHaveCount(0);
    await expect(page.getByTestId("calibrate-ai")).toHaveCount(0);
    await expect(page.getByTestId("calibrate-ai-off")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Announce results|Reopen grading/ })).toHaveCount(0);
    await expect(page.getByTestId("finish-hint")).toHaveCount(0);
    await expect(page.getByRole("note").filter({ hasText: "announce" })).toHaveCount(0);
    await page.locator("main tbody tr").first().click();
    await expect(page.getByTestId("detail-grade")).toBeVisible();
    await expect(page.getByTestId("detail-regrade")).toHaveCount(0);
  });

  test("a TA gives a score on the Grade screen and it is saved", async ({ page }) => {
    await asTa(page, `${A}/assignments/a-q/recheck?sub=sub-3`);
    await page.getByLabel(/Total score/i).fill("77");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect.poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; instructorScore: number | null; status: string }[]).find((s) => s.id === "sub-3")))
      .toMatchObject({ instructorScore: 77, status: "graded" });
  });

  test("the Score Book is for looking: no Export", async ({ page }) => {
    await asTa(page, `${A}/results`);
    await expect(page.getByRole("heading", { name: /Score Book/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Export/ })).toHaveCount(0);
  });

  test("the Assignments list and an assignment are read-only: no Create, no Edit, no Delete menu", async ({ page }) => {
    await asTa(page, `${A}/assignments`);
    await expect(page.getByText("Quiz").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Assignment" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Actions for Quiz/ })).toHaveCount(0);
    await go(page, `${A}/assignments/a-q`);
    await expect(page.getByRole("link", { name: "Edit Assignment" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  });

  test("the Students list is read-only: the names are there, Add / Import and the Actions column are not", async ({ page }) => {
    await asTa(page, `${A}/students`);
    await expect(page.getByText("Ann Test")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Student|Import Excel/ })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Withdraw|Remove/ })).toHaveCount(0);
  });

  test("the course Overview has no edit buttons", async ({ page }) => {
    await asTa(page, A);
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Category" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
});

test.describe("the teacher's side of the rule", () => {
  test("Collaborators: the TA search leaves out students enrolled in that subject this term (any section) and says how many", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("tt_seeded")) return;
      sessionStorage.setItem("tt_seeded", "1");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    });
    await seed(page, null);
    await go(page, `${A}/collaborators`);
    await page.getByRole("button", { name: /Add Collaborator/i }).first().click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByTestId("ta-enrolled-note")).toBeVisible();
    await expect(dlg.getByText("Ann Test")).toHaveCount(0);                       // a classmate: enrolled here
    await expect(dlg.getByText("Sec Test")).toHaveCount(0);                       // enrolled in another section of the subject
  });
});
