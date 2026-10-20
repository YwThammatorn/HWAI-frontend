import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
import { LATE_WINDOW_MS, dueAt, submissionClosesAt, gradingOpensAt, isLate, submissionOpen, gradingOpen } from "../src/lib/assignments";

// 15/10/2569 — grading opens only after the due date and the students' late hour (one value for the whole system).
//   due date 10 March  →  students can submit until 00:59:59 on 11 March  →  the teacher can grade from 01:00 on 11 March.
// The clock is fixed by Playwright (page.clock) so each test stands at a chosen moment.

const NOW = "2026-01-01T00:00:00.000Z";
const BEFORE_DUE = new Date("2026-03-10T12:00:00");
const LATE_HOUR = new Date("2026-03-11T00:30:00");
const AFTER_WINDOW = new Date("2026-03-11T01:05:00");

const COURSE = {
  id: "c-gw", name: "Programming", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  courseTemplateId: "ct-gw", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-gw", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-gw"] };
const lv = (label: string) => ({ label, description: `${label} wording` });
const LEVELS = [lv("Excellent"), lv("Fair"), lv("Needs work"), lv("Fail")];
const asg = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-gw", name, description: "", dueDate: "2026-03-10", maxPoints: 9, submissionType: "individual", maxGroupSize: null,
  acceptsFiles: true, fileTypes: ["pdf"], rubricIds: [`r-${id}`], createdAt: NOW, updatedAt: NOW, ...extra,
});
const rubric = (id: string) => ({
  id: `r-${id}`, assignmentId: id, name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [{ id: "c1", name: "C1 · Design / การออกแบบ", description: "", maxPoints: 9, weight: 100, levels: LEVELS }],
});
const sub = (aid: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${aid}-s${n}`, assignmentId: aid, studentId: `640705${n}`, studentName: `Student ${n}`, email: `s${n}@kmitl.ac.th`, submittedAt: "2026-03-09T10:00:00.000Z", fileUrl: null,
  aiScore: null, instructorScore: null, instructorComment: "", externalUseConsent: false, status: "not_graded", updatedAt: NOW, ...extra,
});

interface Seed { assignments: unknown[]; subs: unknown[]; role?: "teacher" | "student" }
async function seed(page: Page, at: Date, s: Seed) {
  await page.clock.setFixedTime(at);
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("gw_seeded")) return;
    sessionStorage.setItem("gw_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify(d.role === "student"
      ? { name: "Student 1", email: "s1@kmitl.ac.th", role: "student", studentId: "6407051" }
      : { name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "sr-1", courseId: "c-gw", studentId: "6407051", firstName: "Student", lastName: "1", email: "s1@kmitl.ac.th", cohort: "CE69" }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "cs-1", studentId: "6407051", firstName: "Student", lastName: "1", email: "s1@kmitl.ac.th", cohort: "CE69", program: "CE" }]));
  }, {
    role: s.role ?? "teacher", course: COURSE, teacher: TEACHER, assignments: s.assignments, subs: s.subs,
    rubrics: (s.assignments as { id: string; isExam?: boolean }[]).filter((a) => !a.isExam).map((a) => rubric(a.id)),
  });
}
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; late?: boolean; status: string; aiScore: number | null; instructorScore: number | null; criterionScores?: unknown; instructorComment: string; submittedAt: string }[]);

test.describe("the rule, as pure functions", () => {
  const a = { dueDate: "2026-03-10" };
  test("the deadline is the end of the due date; submissions close one hour later; grading opens right after", () => {
    expect(LATE_WINDOW_MS).toBe(3_600_000);
    expect(dueAt(a)!.getTime()).toBe(new Date("2026-03-10T23:59:59").getTime());
    expect(submissionClosesAt(a)!.getTime()).toBe(new Date("2026-03-11T00:59:59").getTime());
    expect(gradingOpensAt(a)!.getTime()).toBe(new Date("2026-03-11T01:00:00").getTime());
  });
  test("at the boundaries: on time, late, closed", () => {
    const at = (iso: string) => new Date(iso).getTime();
    expect(isLate(a, at("2026-03-10T23:59:59"))).toBe(false);                      // exactly on the deadline is still on time
    expect(isLate(a, at("2026-03-10T23:59:59") + 1)).toBe(true);
    expect(isLate(a, at("2026-03-11T00:59:59"))).toBe(true);                       // the last second of the window
    expect(isLate(a, at("2026-03-11T00:59:59") + 1)).toBe(false);
    expect(submissionOpen(a, at("2026-03-11T00:59:59"))).toBe(true);
    expect(submissionOpen(a, at("2026-03-11T00:59:59") + 1)).toBe(false);
    expect(gradingOpen(a, at("2026-03-11T00:59:59"))).toBe(false);                 // still inside the window: nothing to grade yet
    expect(gradingOpen(a, at("2026-03-11T00:59:59") + 1)).toBe(true);
  });
  test("an exam and an assignment without a due date are never locked", () => {
    const now = new Date("2026-03-01T00:00:00").getTime();
    expect(gradingOpen({ dueDate: "2026-12-31", isExam: true }, now)).toBe(true);
    expect(gradingOpen({}, now)).toBe(true);
    expect(submissionOpen({}, now)).toBe(true);
    expect(submissionClosesAt({ dueDate: "2026-12-31", isExam: true })).toBeNull();
  });
});

test.describe("teacher — the course Grading list", () => {
  const ASSIGNMENTS = [asg("a-due", "Web project"), asg("a-exam", "Midterm", { isExam: true, acceptsFiles: false, dueDate: "2026-12-31" }), asg("a-open", "Open-ended", { dueDate: undefined })];
  const SUBS = [sub("a-due", 1), sub("a-due", 2), sub("a-exam", 1, { status: "graded", instructorScore: 5 }), sub("a-open", 1)];

  test("before the due date nothing can be started: the buttons are replaced by when grading opens", async ({ page }) => {
    await seed(page, BEFORE_DUE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    const locked = page.getByTestId("grading-locked");
    await expect(locked).toHaveCount(1);                                                // only the assignment that has a due date to wait for
    await expect(locked).toContainText("Not open for grading yet");
    await expect(locked).toContainText("Opens Mar 11");
    await expect(locked).toContainText("01:00 AM");
    await expect(page.getByRole("button", { name: /Grade with AI/ })).toHaveCount(1);   // the one without a due date is open as before
    await expect(page.locator("li", { hasText: "Web project" }).getByRole("button")).toHaveCount(0);
  });

  test("the late hour is still locked — grading opens only after it", async ({ page }) => {
    await seed(page, LATE_HOUR, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toHaveCount(1);
    await expect(page.locator("li", { hasText: "Web project" }).getByRole("button", { name: /Grade with AI/ })).toHaveCount(0);
  });

  test("after the window the two buttons are there", async ({ page }) => {
    await seed(page, AFTER_WINDOW, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toHaveCount(0);
    const row = page.locator("li", { hasText: "Web project" });
    await expect(row.getByRole("button", { name: "Grade with AI (2)" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Grade manually" })).toBeVisible();
  });

  test("a screen left open flips by itself when the window closes", async ({ page }) => {
    await page.clock.install({ time: LATE_HOUR });
    await page.addInitScript((d) => {
      if (sessionStorage.getItem("gw_seeded")) return;
      sessionStorage.setItem("gw_seeded", "1");
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
      localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
      localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    }, { course: COURSE, teacher: TEACHER, assignments: [ASSIGNMENTS[0]], subs: [SUBS[0], SUBS[1]], rubrics: [rubric("a-due")] });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toBeVisible();
    await page.clock.runFor(35 * 60 * 1000);                                           // 00:30 → 01:05
    await expect(page.getByTestId("grading-locked")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Grade with AI (2)" })).toBeVisible();
  });
});

test.describe("teacher — one assignment", () => {
  const ASSIGNMENTS = [asg("a-due", "Web project")];
  const SUBS = [sub("a-due", 1, { late: true }), sub("a-due", 2)];

  test("before it opens: a note with the times, Grade and Re-grade are off, announcing is off; a 'Late' chip shows who was late", async ({ page }) => {
    await seed(page, LATE_HOUR, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-due/grading`);
    const note = page.getByTestId("grading-window-note");
    await expect(note).toContainText("Not open for grading yet");
    await expect(note).toContainText("Mar 11, 12:59 AM");
    await expect(note).toContainText("Mar 11, 01:00 AM");
    await expect(page.getByTestId("grade-locked")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Re-grade/ }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Announce results" })).toBeDisabled();
    await expect(page.getByTestId("late-chip")).toHaveCount(1);
  });

  test("after it opens: the note is gone and Grade is a link again", async ({ page }) => {
    await seed(page, AFTER_WINDOW, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-due/grading`);
    await expect(page.getByTestId("grading-window-note")).toHaveCount(0);
    await expect(page.getByTestId("grade-locked")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Re-grade/ }).first()).toBeEnabled();
  });

  test("typing the Grade page's address early lands on a closed notice, not the grading panel", async ({ page }) => {
    await seed(page, BEFORE_DUE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-due/recheck?sub=a-due-s1`);
    await expect(page.getByTestId("grade-window-closed")).toContainText("not open for grading yet");
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await page.getByRole("link", { name: "Back to Grading" }).click();
    await expect(page).toHaveURL(/\/teacher\/courses\/c-gw\/grading$/);
  });

  test("the same address after the window shows the grading panel", async ({ page }) => {
    await seed(page, AFTER_WINDOW, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-due/recheck?sub=a-due-s1`);
    await expect(page.getByTestId("grade-window-closed")).toHaveCount(0);
    await expect(page.getByRole("radiogroup").first()).toBeVisible();
  });

  test("the assignment page states the window", async ({ page }) => {
    await seed(page, BEFORE_DUE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-due`);
    await expect(page.getByTestId("grading-window-row")).toContainText("Late work accepted until Mar 11, 12:59 AM");
    await expect(page.getByTestId("grading-window-row")).toContainText("grading opens Mar 11, 01:00 AM");
  });
});

test.describe("student — submitting around the deadline", () => {
  const ASSIGNMENTS = [asg("a-due", "Web project")];
  const open = async (page: Page, at: Date, subs: unknown[] = []) => {
    await seed(page, at, { assignments: ASSIGNMENTS, subs, role: "student" });
    await page.goto(`${BASE}/student/courses/c-gw/classwork/a-due`);
    await page.waitForLoadState("networkidle");
  };
  const send = async (page: Page) => {
    await page.locator('input[type="url"]').fill("https://example.com/my-work");
    await page.getByRole("button", { name: /^(Submit|Resubmit)/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^Confirm/ }).click();
  };

  test("on time: submits normally, not marked late, no late note", async ({ page }) => {
    await open(page, BEFORE_DUE);
    await expect(page.getByTestId("late-note")).toHaveCount(0);
    await send(page);
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    const s = (await stored(page))[0];
    expect(s.late).toBe(false);
    expect(s.status).toBe("not_graded");
  });

  test("in the late hour: still allowed, with a note saying until when, and the submission is marked late", async ({ page }) => {
    await open(page, LATE_HOUR);
    await expect(page.getByTestId("late-note")).toContainText("Past due — you can still submit late until Mar 11, 12:59 AM");
    await send(page);
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    const s = (await stored(page))[0];
    expect(s.late).toBe(true);
    expect(s.submittedAt).toBe(LATE_HOUR.toISOString());
  });

  test("after the window: the form is closed", async ({ page }) => {
    await open(page, AFTER_WINDOW);
    await expect(page.getByTestId("submission-closed")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)/ })).toHaveCount(0);
    await expect(page.locator('input[type="url"]')).toHaveCount(0);
  });

  test("after the window a student who already submitted cannot resubmit either", async ({ page }) => {
    await open(page, AFTER_WINDOW, [sub("a-due", 1, { studentId: "6407051", status: "not_graded" })]);
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)/ })).toHaveCount(0);
  });

  test("a resubmission clears everything the earlier file had earned — the new file starts with no marks", async ({ page }) => {
    const old = sub("a-due", 1, { studentId: "6407051", status: "need_review", aiScore: 62, instructorScore: 70, instructorComment: "Fix the layout", criterionScores: { c1: 6 }, aiCriterionScores: { c1: 6 }, attachments: [], fileUrl: "https://example.com/old" });
    await open(page, LATE_HOUR, [old]);
    await send(page);
    await expect.poll(async () => (await stored(page))[0].status).toBe("not_graded");
    const s = (await stored(page))[0];
    expect(s.aiScore).toBeNull();
    expect(s.instructorScore).toBeNull();
    expect(s.instructorComment).toBe("");
    expect(s.criterionScores).toBeUndefined();
    expect(s.late).toBe(true);
    expect(s.submittedAt).toBe(LATE_HOUR.toISOString());
  });
});

test.describe("Calibration offers only assignments that are open for grading", () => {
  const ASSIGNMENTS = [asg("a-due", "Web project")];
  const AI = [1, 2, 3].map((n) => sub("a-due", n, { status: "graded", aiScore: 5 + n, aiCriterionScores: { c1: 5 + n } }));

  test("inside the window it is not offered; after it, it is", async ({ page }) => {
    await seed(page, LATE_HOUR, { assignments: ASSIGNMENTS, subs: AI });
    await page.goto(`${BASE}/teacher/courses/c-gw/calibration`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#cal-asg")).toHaveCount(0);

    const page2 = await page.context().newPage();
    await seed(page2, AFTER_WINDOW, { assignments: ASSIGNMENTS, subs: AI });
    await page2.goto(`${BASE}/teacher/courses/c-gw/calibration`);
    await expect(page2.locator("#cal-asg option")).toHaveText(["Web project"]);
  });
});
