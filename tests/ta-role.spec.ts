import { test, expect, Page } from "@playwright/test";
import { BASE } from "./base";
import { taPathAllowed } from "../src/lib/taPaths";
import { isEnrolledInSubjectThatTerm, taCourseIdsFor } from "../src/lib/taRules";
import { assignedAssignmentIds, queueFigures } from "../src/lib/taWork";

// 10/11/2569 — the TA role. A TA is a STUDENT the teacher appointed on a course's Collaborators page. Signed in with their own student account they
// get a Student ↔ TA switch in the navbar; on the TA hat they see My Courses (only the courses they assist), and in each: Overview, Assignments
// (read-only), Grading, Score Book (view only, no export) and Students (read-only). They give and change scores; they do not use the AI, edit
// rubrics / assignments / the roster, announce, or export. Rule: a TA must not be enrolled in that subject in that term.
// 10/11/2569 (advisor R28–R30) — a TA works only with the assignments a teacher gave them (Assign work to TAs page): their home is a queue
// "waiting / graded", the Grading list, Assignments list and Score Book show only that work, and another assignment's URL sends them back.
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
const ASSIGNMENTS = [ASSIGN("a-q", "c-ta-a", "Quiz"), ASSIGN("a-other", "c-ta-a", "Other work"), ASSIGN("a-b", "c-ta-b", "DB Lab")];
const sub = (id: string, assignmentId: string, p: { studentId: string; firstName: string }, status: string, score: number | null) => ({
  id, assignmentId, studentId: p.studentId, studentName: `${p.firstName} Test`, email: `${p.studentId}@kmitl.ac.th`, submittedAt: "2026-01-04T10:00:00.000Z", fileUrl: null,
  aiScore: score, instructorScore: status === "graded" ? score : null, instructorComment: "", externalUseConsent: false, status, updatedAt: NOW,
});
const SUBMISSIONS = [
  sub("sub-1", "a-q", CLASSMATES[0], "graded", 80), sub("sub-2", "a-q", CLASSMATES[1], "need_review", 60), sub("sub-3", "a-q", CLASSMATES[2], "not_graded", null),
  sub("sub-o1", "a-other", CLASSMATES[0], "not_graded", null),
];
/** The teacher gave the TA the Quiz only; "Other work" is not theirs. */
const GRADING = [{ id: "ga-1", courseId: "c-ta-a", taAccountId: TA.id, scope: { type: "assignments", assignmentIds: ["a-q"] } }];
const ROLES = [
  { id: "sr-1", accountId: TA.id, courseId: "c-ta-a", role: "ta" },
  { id: "sr-2", accountId: ENR.id, courseId: "c-ta-a", role: "ta" },
];

type Who = { studentId: string; hat: "student" | "ta" };
async function seed(page: Page, who: Who | null = { studentId: TA.studentId, hat: "student" }, grading: unknown[] = GRADING) {
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
    localStorage.setItem("hwai_grading_assignments_v1", JSON.stringify(d.grading));
  }, { grading, who, courses: COURSES, teacher: TEACHER, cohort: [TA, ENR, SECOND, ...CLASSMATES], roster: ROSTER, assignments: ASSIGNMENTS, submissions: SUBMISSIONS, roles: ROLES });
}
const go = async (page: Page, url: string) => { await page.goto(`${BASE}${url}`); await page.waitForLoadState("networkidle"); };
const asTa = async (page: Page, url = "/teacher/courses", grading: unknown[] = GRADING) => { await seed(page, { studentId: TA.studentId, hat: "ta" }, grading); await go(page, url); };
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
    // an assignment's page names the assignment, so the app can check it is the TA's
    expect(taPathAllowed("/teacher/courses/c9/assignments/a7/recheck")).toEqual({ allowed: true, courseId: "c9", assignmentId: "a7" });
    expect(taPathAllowed("/teacher/courses/c9/assignments/a7")).toEqual({ allowed: true, courseId: "c9", assignmentId: "a7" });
    expect(taPathAllowed("/teacher/courses/c9/assignments")).toEqual({ allowed: true, courseId: "c9" });
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

  test("the course Overview is the TA's queue, not the teacher's dashboard: no description card, no edit buttons, no categories, no Settings", async ({ page }) => {
    await asTa(page, A);
    await expect(page.getByTestId("ta-queue")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Description" })).toHaveCount(0);
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

test.describe("assigned work (advisor R28–R30)", () => {
  test("pure: a TA's assignments are the ones in their own records of that course; the queue counts waiting and graded the way \"N to grade\" does", () => {
    const records = [
      { id: "1", courseId: "c1", taAccountId: "ta1", scope: { type: "assignments", assignmentIds: ["a", "b"] } },
      { id: "2", courseId: "c1", taAccountId: "ta2", scope: { type: "assignments", assignmentIds: ["c"] } },
      { id: "3", courseId: "c2", taAccountId: "ta1", scope: { type: "assignments", assignmentIds: ["z"] } },
      { id: "4", courseId: "c1", taAccountId: "ta1", scope: { type: "week", weekNumbers: [1] } },          // an older kind of record gives no assignments
    ] as never[];
    expect([...assignedAssignmentIds(records, "c1", "ta1")].sort()).toEqual(["a", "b"]);
    expect([...assignedAssignmentIds(records, "c1", "ta2")]).toEqual(["c"]);
    expect([...assignedAssignmentIds(records, "c1", null)]).toEqual([]);
    const subs: Record<string, { status: string }[]> = { a: [{ status: "graded" }, { status: "need_review" }, { status: "not_graded" }], b: [{ status: "graded" }] };
    expect(queueFigures([{ id: "a" }, { id: "b" }], (id) => subs[id] as never[])).toEqual({ waiting: 2, graded: 2, total: 4, assignments: 2 });
    expect(queueFigures([], () => [])).toEqual({ waiting: 0, graded: 0, total: 0, assignments: 0 });
  });

  test("My Courses: the card says what is waiting and what is graded in the work given to the TA, not the course's \"to grade\"", async ({ page }) => {
    await asTa(page, "/teacher/courses");
    const card = page.getByRole("link", { name: /UX Course/ });
    await expect(card.getByTestId("ta-queue")).toHaveText("2 waiting · 1 graded");                  // the Quiz: sub-2 and sub-3 wait, sub-1 is graded; "Other work" is not theirs
    await expect(card).not.toContainText("to grade");
  });

  test("My Courses: a TA with nothing assigned yet is told so", async ({ page }) => {
    await asTa(page, "/teacher/courses", []);
    await expect(page.getByRole("link", { name: /UX Course/ }).getByTestId("ta-queue-empty")).toHaveText("No work assigned yet");
  });

  test("Overview: waiting / graded / assigned figures, the assigned work as rows with its stage, and a Grade next button to the next piece", async ({ page }) => {
    await asTa(page, A);
    const q = page.getByTestId("ta-queue");
    await expect(q.getByText("Waiting to grade")).toBeVisible();
    await expect(q.getByText("Graded", { exact: true }).first()).toBeVisible();
    await expect(q.getByText("Assigned work")).toBeVisible();
    await expect(page.getByTestId("ta-queue-row-a-q")).toContainText("Quiz");
    await expect(page.getByTestId("ta-queue-row-a-q")).toContainText("2 waiting");
    await expect(page.getByTestId("ta-queue-row-a-q")).toContainText("1 graded");
    await expect(page.getByTestId("ta-queue-row-a-other")).toHaveCount(0);
    await expect(page.getByTestId("grade-next-ta")).toHaveAttribute("href", `${A}/assignments/a-q/grading`);
  });

  test("Overview with nothing assigned: an empty state, no queue", async ({ page }) => {
    await asTa(page, A, []);
    await expect(page.getByTestId("ta-queue-empty")).toContainText("No work assigned to you yet");
    await expect(page.getByTestId("ta-queue")).toHaveCount(0);
  });

  test("Grading and Assignments list only the assigned assignment — the other one is not there", async ({ page }) => {
    await asTa(page, `${A}/grading`);
    await expect(page.locator("main li", { hasText: "Quiz" }).getByTestId("ta-grade")).toBeVisible();
    await expect(page.getByText("Other work")).toHaveCount(0);
    await go(page, `${A}/assignments`);
    await expect(page.getByText("Quiz").first()).toBeVisible();
    await expect(page.getByText("Other work")).toHaveCount(0);
  });

  test("Grading with nothing assigned: an empty state without a Create button", async ({ page }) => {
    await asTa(page, `${A}/grading`, []);
    await expect(page.getByText("No work assigned to you yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Assignment" })).toHaveCount(0);
  });

  test("the URL of an assignment that is not theirs sends the TA to the course Grading list — grading, recheck and detail; their own assignment still opens", async ({ page }) => {
    await asTa(page, `${A}/assignments/a-q/grading`);
    await expect(page).toHaveURL(/\/assignments\/a-q\/grading$/);
    for (const url of [`${A}/assignments/a-other/grading`, `${A}/assignments/a-other/recheck?sub=sub-o1`, `${A}/assignments/a-other`, `${A}/assignments/a-other/results`]) {
      await go(page, url);
      await expect(page, url).toHaveURL(new RegExp(`${A}/grading$`));
      await go(page, `${A}/assignments/a-q/grading`);
    }
  });

  test("Score Book: only the assigned assignment is a column, and there is no Total, class average or Class summary (a total of part of the work would mislead)", async ({ page }) => {
    await asTa(page, `${A}/results`);
    await expect(page.getByRole("link", { name: "Quiz" }).first()).toBeVisible();
    await expect(page.getByText("Other work")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /^Total/ })).toHaveCount(0);
    await expect(page.getByText("Class average")).toHaveCount(0);
    await expect(page.getByTestId("partial-total")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Class summary/ }).or(page.getByRole("button", { name: /Class summary/ }))).toHaveCount(0);
  });

  test("Score Book with nothing assigned: an empty state", async ({ page }) => {
    await asTa(page, `${A}/results`, []);
    await expect(page.getByText("No work assigned to you yet")).toBeVisible();
  });
});

test.describe("Assign work to TAs (the teacher's page)", () => {
  async function asTeacher(page: Page, url: string, grading: unknown[] = GRADING) {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("tt_seeded")) return;
      sessionStorage.setItem("tt_seeded", "1");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    });
    await seed(page, null, grading);
    await go(page, url);
  }
  const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_grading_assignments_v1") ?? "[]") as { courseId: string; taAccountId: string; scope: { type: string; assignmentIds: string[] } }[]);
  const P = `${A}/grading-split`;

  test("the course menu has it for the teacher (not for the TA), and the page lists the course's TAs with their work and progress — not a TA who is enrolled in the subject", async ({ page }) => {
    await asTeacher(page, P);
    await expect(page.getByRole("navigation", { name: "UX Course" }).getByRole("link", { name: "Assign work to TAs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assign work to TAs" })).toBeVisible();
    const row = page.getByTestId(`ta-row-${TA.studentId}`);
    await expect(row).toContainText("Tia Test");
    await expect(row).toContainText("Quiz");
    await expect(row.getByTestId("ta-waiting")).toHaveText("2");
    await expect(row.getByTestId("ta-graded")).toHaveText("1");
    await expect(page.getByTestId(`ta-row-${ENR.studentId}`)).toHaveCount(0);                      // appointed, but enrolled this term: no TA access, so nothing to assign
  });

  test("a TA's own menu does not have it, and the page itself is not theirs", async ({ page }) => {
    await asTa(page, A);
    await expect(page.getByRole("link", { name: "Assign work to TAs" })).toHaveCount(0);
    await go(page, P);
    await expect(page).toHaveURL(/\/teacher\/courses$/);
  });

  test("ticking assignments in the popup gives them to the TA: saved, shown as chips, and the waiting figure follows", async ({ page }) => {
    await asTeacher(page, P);
    await page.getByTestId(`assign-open-${TA.studentId}`).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByTestId("assign-a-q")).toBeChecked();
    await expect(dlg.getByTestId("assign-a-other")).not.toBeChecked();
    await expect(dlg.getByText("1 of 2 ticked")).toBeVisible();
    await dlg.getByTestId("assign-a-other").check();
    await dlg.getByTestId("assign-save").click();
    await expect(dlg).toHaveCount(0);
    await expect.poll(async () => (await stored(page)).map((g) => [...g.scope.assignmentIds].sort())).toEqual([["a-other", "a-q"]]);
    await expect(page.getByTestId(`ta-row-${TA.studentId}`)).toContainText("Other work");
    await expect(page.getByTestId(`ta-row-${TA.studentId}`).getByTestId("ta-waiting")).toHaveText("3");
  });

  test("Select all ticks every assignment; unticking everything takes the work back (the record goes, the TA stays appointed)", async ({ page }) => {
    await asTeacher(page, P);
    await page.getByTestId(`assign-open-${TA.studentId}`).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByTestId("assign-all").check();
    await expect(dlg.getByTestId("assign-a-other")).toBeChecked();
    await dlg.getByTestId("assign-all").uncheck();
    await expect(dlg.getByTestId("assign-a-q")).not.toBeChecked();
    await dlg.getByTestId("assign-save").click();
    await expect.poll(async () => (await stored(page)).length).toBe(0);
    await expect(page.getByTestId(`ta-row-${TA.studentId}`).getByTestId("no-work")).toBeVisible();
    await expect(page.getByTestId(`assign-open-${TA.studentId}`)).toContainText("Assign work");
    const roles = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_section_roles_v1") ?? "[]") as { role: string }[]);
    expect(roles.filter((r) => r.role === "ta").length).toBe(2);
  });

  test("what the teacher gives is what the TA sees (end to end through storage)", async ({ page }) => {
    await asTeacher(page, P, []);
    await page.getByTestId(`assign-open-${TA.studentId}`).click();
    await page.getByRole("dialog").getByTestId("assign-a-other").check();
    await page.getByRole("dialog").getByTestId("assign-save").click();
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    await page.evaluate((s) => localStorage.setItem("hwai_user", JSON.stringify({ name: "Tia", email: `${s}@kmitl.ac.th`, role: "ta", studentId: s })), TA.studentId);
    await go(page, `${A}/assignments`);
    await expect(page.getByText("Other work").first()).toBeVisible();
    await expect(page.getByText("Quiz")).toHaveCount(0);
  });

  test("a course with no TA says so and points to Collaborators", async ({ page }) => {
    await asTeacher(page, `/teacher/courses/c-ta-a2/grading-split`);
    await expect(page.getByText("This course has no TAs yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Collaborators" })).toHaveAttribute("href", "/teacher/courses/c-ta-a2/collaborators");
  });

  test("Collaborators: the TA row shows how much work they were given and links here; removing the TA takes their assignments with them", async ({ page }) => {
    await asTeacher(page, `${A}/collaborators`);
    await expect(page.getByTestId("ta-assigned-link").first()).toHaveText("Assigned work: 1");
    await expect(page.getByTestId("ta-assigned-link").first()).toHaveAttribute("href", P);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("row", { name: /Tia Test/ }).getByRole("button", { name: "Remove from course" }).click();
    await expect.poll(async () => (await stored(page)).length).toBe(0);
  });

  test("deleting an assignment takes it off the TA's list", async ({ page }) => {
    await asTeacher(page, `${A}/assignments`, [{ id: "ga-2", courseId: "c-ta-a", taAccountId: TA.id, scope: { type: "assignments", assignmentIds: ["a-q", "a-other"] } }]);
    await page.getByRole("button", { name: "Actions for Other work" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await expect.poll(async () => (await stored(page))[0]?.scope.assignmentIds).toEqual(["a-q"]);
  });
});
