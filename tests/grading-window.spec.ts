import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
import { dueAt, submissionClosesAt, gradingOpensAt, isLate, submissionOpen, gradingOpen, daysLate, latePenaltyFor, latePenaltyOf, finalScoreOf, latePolicyProblem, cleanLatePolicy, activeLatePolicy, type LatePolicy } from "../src/lib/assignments";

// Grading opens only once submissions have closed (15/10/2569, reworked 21/10/2569: the fixed late hour is gone, the teacher decides).
//   no late policy:  due 10 March  →  submissions close at the end of 10 March  →  grading opens at 00:00 on 11 March.
//   late policy until 13 March (2 points off per late day, at most 6)  →  students may submit through 13 March  →  grading opens on 14 March.
// The clock is fixed by Playwright (page.clock) so each test stands at a chosen moment.

const NOW = "2026-01-01T00:00:00.000Z";
const POLICY: LatePolicy = { closeDate: "2026-03-13", mode: "perDay", unit: "points", amount: 2, cap: 6 };
const BEFORE_DUE = new Date("2026-03-10T12:00:00");
const JUST_AFTER = new Date("2026-03-11T00:30:00");     // a day late: closed without a policy, still open with one
const LATE_DAY_2 = new Date("2026-03-12T10:00:00");
const AFTER_CLOSE = new Date("2026-03-14T09:00:00");    // closed either way

const COURSE = {
  id: "c-gw", name: "Programming", description: "", status: "active", source: "manual", coverColor: "#2DD4BF", iconColor: "#2DD4BF",
  courseTemplateId: "ct-gw", term: 1, academicYear: 2569, sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-gw", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", status: "active", courseIds: ["c-gw"] };
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
  id: `${aid}-s${n}`, assignmentId: aid, studentId: `640705${n}`, studentName: `Student ${n}`, email: `s${n}@kmitl.ac.th`, submittedAt: "2026-03-09T10:00:00.000Z", 
  aiScore: null, instructorScore: null, instructorComment: "", status: "not_graded", updatedAt: NOW, ...extra,
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
    localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "sr-1", courseId: "c-gw", studentId: "6407051", name: "Student 1", email: "s1@kmitl.ac.th", cohort: "CE69" }]));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "cs-1", studentId: "6407051", name: "Student 1", email: "s1@kmitl.ac.th", cohort: "CE69", program: "CE" }]));
  }, {
    role: s.role ?? "teacher", course: COURSE, teacher: TEACHER, assignments: s.assignments, subs: s.subs,
    rubrics: (s.assignments as { id: string; isExam?: boolean }[]).filter((a) => !a.isExam).map((a) => rubric(a.id)),
  });
}
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; late?: boolean; status: string; aiScore: number | null; instructorScore: number | null; criterionScores?: unknown; instructorComment: string; submittedAt: string }[]);

test.describe("the rule, as pure functions", () => {
  const plain = { dueDate: "2026-03-10", maxPoints: 10 };
  const withPolicy = { ...plain, latePolicy: POLICY };
  const at = (iso: string) => new Date(iso).getTime();

  test("without a policy: the deadline is the end of the due date, submissions close with it, grading opens right after", () => {
    expect(dueAt(plain)!.getTime()).toBe(new Date("2026-03-10T23:59:59").getTime());
    expect(submissionClosesAt(plain)!.getTime()).toBe(new Date("2026-03-10T23:59:59").getTime());
    expect(gradingOpensAt(plain)!.getTime()).toBe(new Date("2026-03-11T00:00:00").getTime());
    expect(isLate(plain, at("2026-03-11T00:30:00"))).toBe(false);                    // nothing is "late": it is closed
    expect(submissionOpen(plain, at("2026-03-11T00:30:00"))).toBe(false);
  });
  test("with a policy: submissions stay open through the close date and grading opens the day after", () => {
    expect(submissionClosesAt(withPolicy)!.getTime()).toBe(new Date("2026-03-13T23:59:59").getTime());
    expect(gradingOpensAt(withPolicy)!.getTime()).toBe(new Date("2026-03-14T00:00:00").getTime());
    expect(isLate(withPolicy, at("2026-03-10T23:59:59"))).toBe(false);               // exactly on the deadline is still on time
    expect(isLate(withPolicy, at("2026-03-10T23:59:59") + 1)).toBe(true);
    expect(isLate(withPolicy, at("2026-03-13T23:59:59"))).toBe(true);                // the last second
    expect(isLate(withPolicy, at("2026-03-13T23:59:59") + 1)).toBe(false);
    expect(submissionOpen(withPolicy, at("2026-03-13T23:59:59"))).toBe(true);
    expect(submissionOpen(withPolicy, at("2026-03-13T23:59:59") + 1)).toBe(false);
    expect(gradingOpen(withPolicy, at("2026-03-13T23:59:59"))).toBe(false);          // still taking work: nothing to grade yet
    expect(gradingOpen(withPolicy, at("2026-03-13T23:59:59") + 1)).toBe(true);
  });
  test("a close date that is not after the due date counts as no late work", () => {
    const bad = { ...plain, latePolicy: { ...POLICY, closeDate: "2026-03-10" } };
    expect(activeLatePolicy(bad)).toBeUndefined();
    expect(submissionClosesAt(bad)!.getTime()).toBe(dueAt(plain)!.getTime());
  });
  test("an exam and an assignment without a due date are never locked", () => {
    const now = new Date("2026-03-01T00:00:00").getTime();
    expect(gradingOpen({ dueDate: "2026-12-31", isExam: true }, now)).toBe(true);
    expect(gradingOpen({}, now)).toBe(true);
    expect(submissionOpen({}, now)).toBe(true);
    expect(submissionClosesAt({ dueDate: "2026-12-31", isExam: true, latePolicy: POLICY })).toBeNull();
  });

  test("late days are whole calendar days after the due date", () => {
    expect(daysLate(plain, new Date("2026-03-10T23:59:59").getTime())).toBe(0);
    expect(daysLate(plain, new Date("2026-03-11T00:00:00").getTime())).toBe(1);
    expect(daysLate(plain, new Date("2026-03-11T23:59:59").getTime())).toBe(1);
    expect(daysLate(plain, new Date("2026-03-12T00:00:00").getTime())).toBe(2);
    expect(daysLate({}, new Date("2026-03-12T00:00:00").getTime())).toBe(0);
  });
  test("per day: the amount times the days, capped; in percent it is a share of the full score", () => {
    expect([1, 2, 3, 4].map((n) => latePenaltyFor(POLICY, n, 10))).toEqual([2, 4, 6, 6]);
    const pct: LatePolicy = { closeDate: "2026-03-20", mode: "perDay", unit: "percent", amount: 10 };
    expect([1, 2, 12].map((n) => latePenaltyFor(pct, n, 50))).toEqual([5, 10, 50]);   // no cap: never more than the full score
    expect(latePenaltyFor({ ...pct, cap: 25 }, 9, 40)).toBe(10);                      // the cap is 25 percent of 40
  });
  test("by delay: the first tier that covers the lateness; later than the last tier pays the last", () => {
    const tiers: LatePolicy = { closeDate: "2026-03-20", mode: "tiers", unit: "percent", tiers: [{ untilDay: 7, amount: 50 }, { untilDay: 1, amount: 10 }, { untilDay: 3, amount: 30 }] };
    expect([1, 2, 3, 4, 7, 9].map((n) => latePenaltyFor(tiers, n, 100))).toEqual([10, 30, 30, 50, 50, 50]);
  });
  test("one-time, no deduction, on time, and no policy", () => {
    const flat: LatePolicy = { closeDate: "2026-03-20", mode: "flat", unit: "points", amount: 3 };
    expect([1, 5].map((n) => latePenaltyFor(flat, n, 10))).toEqual([3, 3]);
    expect(latePenaltyFor({ ...flat, mode: "none" }, 5, 10)).toBe(0);
    expect(latePenaltyFor(flat, 0, 10)).toBe(0);
    expect(latePenaltyFor(undefined, 5, 10)).toBe(0);
  });
  test("the counted score is the marks minus the deduction, never below 0", () => {
    const s = (iso: string, instructorScore: number | null, aiScore: number | null = null) => ({ submittedAt: new Date(iso).toISOString(), instructorScore, aiScore });
    expect(finalScoreOf(withPolicy, s("2026-03-12T12:00:00", 9))).toBe(5);           // 2 days late: 4 off
    expect(finalScoreOf(withPolicy, s("2026-03-12T12:00:00", null, 7))).toBe(3);     // the AI's mark when the teacher has none
    expect(finalScoreOf(withPolicy, s("2026-03-12T12:00:00", 3))).toBe(0);
    expect(finalScoreOf(withPolicy, s("2026-03-10T12:00:00", 9))).toBe(9);           // on time
    expect(finalScoreOf(plain, s("2026-03-12T12:00:00", 9))).toBe(9);                // no policy
    expect(finalScoreOf(withPolicy, s("2026-03-12T12:00:00", null))).toBeNull();
    expect(latePenaltyOf(withPolicy, { submittedAt: new Date("2026-03-11T12:00:00").toISOString() })).toBe(2);
  });
  test("a policy is checked before it is saved, and stored with only the fields its style uses", () => {
    expect(latePolicyProblem(POLICY, "2026-03-10")).toBeNull();
    expect(latePolicyProblem({ ...POLICY, closeDate: "2026-03-10" }, "2026-03-10")).toBe("close");
    expect(latePolicyProblem({ ...POLICY, amount: undefined }, "2026-03-10")).toBe("amount");
    expect(latePolicyProblem({ ...POLICY, unit: "percent", amount: 120 }, "2026-03-10")).toBe("amount");
    expect(latePolicyProblem({ closeDate: "2026-03-13", mode: "tiers", unit: "percent", tiers: [] }, "2026-03-10")).toBe("tiers");
    expect(latePolicyProblem({ closeDate: "2026-03-13", mode: "tiers", unit: "percent", tiers: [{ untilDay: 1, amount: 5 }, { untilDay: 1, amount: 9 }] }, "2026-03-10")).toBe("tiers");
    expect(cleanLatePolicy({ ...POLICY, mode: "flat", tiers: [{ untilDay: 1, amount: 5 }] })).toEqual({ closeDate: "2026-03-13", mode: "flat", unit: "points", amount: 2 });
  });
});

test.describe("teacher — the course Grading list", () => {
  const ASSIGNMENTS = [
    asg("a-due", "Web project"),
    asg("a-late", "Poster", { latePolicy: POLICY }),
    asg("a-exam", "Midterm", { isExam: true, acceptsFiles: false, dueDate: "2026-12-31" }),
    asg("a-open", "Open-ended", { dueDate: undefined }),
  ];
  const SUBS = [sub("a-due", 1), sub("a-due", 2), sub("a-late", 1), sub("a-exam", 1, { status: "graded", instructorScore: 5 }), sub("a-open", 1)];

  test("before the due date nothing can be started: the buttons are replaced by when grading opens", async ({ page }) => {
    await seed(page, BEFORE_DUE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    const locked = page.getByTestId("grading-locked");
    await expect(locked).toHaveCount(2);                                                // the two that have a due date to wait for
    await expect(locked.first()).toContainText("Not open for grading yet");
    await expect(page.locator("li", { hasText: "Web project" }).getByTestId("grading-locked")).toContainText("Opens Mar 11");
    await expect(page.locator("li", { hasText: "Poster" }).getByTestId("grading-locked")).toContainText("Opens Mar 14");
    await expect(page.getByRole("button", { name: /Grade with AI/ })).toHaveCount(1);   // the one without a due date is open as before
    await expect(page.locator("li", { hasText: "Web project" }).getByRole("button")).toHaveCount(0);
  });

  test("the day after the deadline: closed work can be graded, work still being accepted late cannot", async ({ page }) => {
    await seed(page, JUST_AFTER, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toHaveCount(1);
    await expect(page.locator("li", { hasText: "Poster" }).getByTestId("grading-locked")).toContainText("Opens Mar 14");
    await expect(page.locator("li", { hasText: "Web project" }).getByRole("button", { name: "Grade with AI (2)" })).toBeVisible();
    await expect(page.locator("li", { hasText: "Poster" }).getByRole("button", { name: /Grade with AI/ })).toHaveCount(0);
  });

  test("after the close date every button is there", async ({ page }) => {
    await seed(page, AFTER_CLOSE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toHaveCount(0);
    const row = page.locator("li", { hasText: "Poster" });
    await expect(row.getByRole("button", { name: "Grade with AI (1)" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Grade manually" })).toBeVisible();
  });

  test("a screen left open flips by itself when the close date passes", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-03-13T23:30:00") });
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
    }, { course: COURSE, teacher: TEACHER, assignments: [ASSIGNMENTS[1]], subs: [SUBS[2]], rubrics: [rubric("a-late")] });
    await page.goto(`${BASE}/teacher/courses/c-gw/grading`);
    await expect(page.getByTestId("grading-locked")).toBeVisible();
    await page.clock.runFor(35 * 60 * 1000);                                           // 23:30 to 00:05 on the 14th
    await expect(page.getByTestId("grading-locked")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Grade with AI (1)" })).toBeVisible();
  });
});

test.describe("teacher — one assignment", () => {
  const ASSIGNMENTS = [asg("a-late", "Poster", { latePolicy: POLICY }), asg("a-plain", "Web project")];
  const SUBS = [
    sub("a-late", 1, { late: true, submittedAt: "2026-03-12T12:00:00.000Z" }), sub("a-late", 2),
    sub("a-plain", 1), sub("a-plain", 2),
  ];

  test("while work is still accepted: a note with the times, Grade and Re-grade are off, announcing is off; a 'Late' chip shows who was late", async ({ page }) => {
    await seed(page, LATE_DAY_2, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/grading`);
    const note = page.getByTestId("grading-window-note");
    await expect(note).toContainText("Not open for grading yet");
    await expect(note).toContainText("Mar 13, 11:59 PM");
    await expect(note).toContainText("Mar 14, 12:00 AM");
    await expect(page.getByTestId("grade-locked")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(0);
    await page.locator("main tbody tr").first().click();                                  // Re-grade lives in the detail of a picked row now
    await expect(page.getByTestId("detail-regrade")).toBeDisabled();
    await expect(page.getByTestId("detail-grade-locked")).toBeVisible();
    await expect(page.getByTestId("grade-next-locked")).toBeVisible();
    await expect(page.getByRole("button", { name: "Announce results" })).toBeDisabled();
    await expect(page.getByTestId("late-chip")).toHaveCount(1);
  });

  test("after the close date: the note is gone and Grade is a link again", async ({ page }) => {
    await seed(page, AFTER_CLOSE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/grading`);
    await expect(page.getByTestId("grading-window-note")).toHaveCount(0);
    await expect(page.getByTestId("grade-locked")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(2);
    await page.locator("main tbody tr").first().click();
    await expect(page.getByTestId("detail-regrade")).toBeEnabled();
  });

  test("with no late work accepted the Grade link is there the day after the deadline", async ({ page }) => {
    await seed(page, JUST_AFTER, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-plain/grading`);
    await expect(page.getByTestId("grading-window-note")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(2);
  });

  test("typing the Grade page's address early lands on a closed notice, not the grading panel", async ({ page }) => {
    await seed(page, LATE_DAY_2, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/recheck?sub=a-late-s1`);
    await expect(page.getByTestId("grade-window-closed")).toContainText("not open for grading yet");
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await page.getByRole("link", { name: "Back to Grading" }).click();
    await expect(page).toHaveURL(/\/teacher\/courses\/c-gw\/grading$/);
  });

  test("the same address after the close date shows the grading panel", async ({ page }) => {
    await seed(page, AFTER_CLOSE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/recheck?sub=a-late-s1`);
    await expect(page.getByTestId("grade-window-closed")).toHaveCount(0);
    await expect(page.getByRole("radiogroup").first()).toBeVisible();
  });

  test("the assignment page states when work closes and what late work costs", async ({ page }) => {
    await seed(page, BEFORE_DUE, { assignments: ASSIGNMENTS, subs: SUBS });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late`);
    await expect(page.getByTestId("grading-window-row")).toContainText("Late work accepted until Mar 13, 11:59 PM");
    await expect(page.getByTestId("grading-window-row")).toContainText("grading opens Mar 14, 12:00 AM");
    await expect(page.getByTestId("late-policy-row")).toContainText("Late work loses 2 pts per day, up to 6 pts");
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-plain`);
    await expect(page.getByTestId("grading-window-row")).toContainText("no late work");
    await expect(page.getByTestId("late-policy-row")).toHaveCount(0);
  });

  test("the grading table shows the counted score and what late work lost; the Grade page shows the same", async ({ page }) => {
    const graded = sub("a-late", 1, { late: true, submittedAt: "2026-03-12T12:00:00.000Z", status: "graded", instructorScore: 8, aiScore: 8, criterionScores: { c1: 8 } });
    await seed(page, AFTER_CLOSE, { assignments: ASSIGNMENTS, subs: [graded, sub("a-late", 2)] });
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/grading`);
    await expect(page.getByTestId("late-penalty")).toContainText("−4");               // 2 days late: 2 points a day
    await expect(page.locator("tr", { hasText: "Student 1" })).toContainText("4/9");  // 8 marks minus 4
    await page.goto(`${BASE}/teacher/courses/c-gw/assignments/a-late/recheck?sub=a-late-s1`);
    await expect(page.getByTestId("late-deduction")).toContainText("2 days late");
    await expect(page.getByTestId("late-deduction")).toContainText("4 / 9");
  });
});

test.describe("student — submitting around the deadline", () => {
  const ASSIGNMENTS = [asg("a-due", "Web project"), asg("a-late", "Poster", { latePolicy: POLICY })];
  const open = async (page: Page, at: Date, id: string, subs: unknown[] = [], assignments: unknown[] = ASSIGNMENTS) => {
    await seed(page, at, { assignments, subs, role: "student" });
    await page.goto(`${BASE}/student/courses/c-gw/classwork/${id}`);
    await page.waitForLoadState("networkidle");
  };
  const send = async (page: Page) => {
    await page.locator('input[type="url"]').fill("https://example.com/my-work");
    await page.getByRole("button", { name: /^(Submit|Resubmit)/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^Confirm/ }).click();
  };

  test("on time: submits normally, not marked late, no late-cost note, but a policy is announced up front", async ({ page }) => {
    await open(page, BEFORE_DUE, "a-late");
    await expect(page.getByTestId("late-note")).toHaveCount(0);
    await expect(page.getByTestId("late-policy-note")).toContainText("Late work accepted until Mar 13");
    await expect(page.getByTestId("late-policy-note")).toContainText("2 pts per day");
    await send(page);
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    const s = (await stored(page))[0];
    expect(s.late).toBe(false);
    expect(s.status).toBe("not_graded");
  });

  test("an assignment that takes no late work says nothing about it", async ({ page }) => {
    await open(page, BEFORE_DUE, "a-due");
    await expect(page.getByTestId("late-policy-note")).toHaveCount(0);
  });

  test("late with a policy: still allowed, with the closing date and what it costs now, and the submission is marked late", async ({ page }) => {
    await open(page, LATE_DAY_2, "a-late");
    await expect(page.getByTestId("late-note")).toContainText("Past due — you can still submit late until Mar 13");
    await expect(page.getByTestId("late-cost")).toContainText("Submitting now (2 days late) costs 4 points");
    await send(page);
    await expect.poll(async () => (await stored(page)).length).toBe(1);
    const s = (await stored(page))[0];
    expect(s.late).toBe(true);
    expect(s.submittedAt).toBe(LATE_DAY_2.toISOString());
  });

  test("late without a policy: the form is closed", async ({ page }) => {
    await open(page, JUST_AFTER, "a-due");
    await expect(page.getByTestId("submission-closed")).toContainText("due date has passed");
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)/ })).toHaveCount(0);
    await expect(page.locator('input[type="url"]')).toHaveCount(0);
  });

  test("after the closing date: the form is closed", async ({ page }) => {
    await open(page, AFTER_CLOSE, "a-late");
    await expect(page.getByTestId("submission-closed")).toContainText("closing date has passed");
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)/ })).toHaveCount(0);
  });

  test("after it closes a student who already submitted cannot resubmit either", async ({ page }) => {
    await open(page, AFTER_CLOSE, "a-late", [sub("a-late", 1, { studentId: "6407051", status: "not_graded" })]);
    await expect(page.getByRole("button", { name: /^(Submit|Resubmit)/ })).toHaveCount(0);
  });

  test("a resubmission clears everything the earlier file had earned: the new file starts with no marks", async ({ page }) => {
    const old = sub("a-late", 1, { studentId: "6407051", status: "need_review", aiScore: 62, instructorScore: 70, instructorComment: "Fix the layout", criterionScores: { c1: 6 }, aiCriterionScores: { c1: 6 }, attachments: [] });
    await open(page, LATE_DAY_2, "a-late", [old]);
    await send(page);
    await expect.poll(async () => (await stored(page))[0].status).toBe("not_graded");
    const s = (await stored(page))[0];
    expect(s.aiScore).toBeNull();
    expect(s.instructorScore).toBeNull();
    expect(s.instructorComment).toBe("");
    expect(s.criterionScores).toBeUndefined();
    expect(s.late).toBe(true);
    expect(s.submittedAt).toBe(LATE_DAY_2.toISOString());
  });

  test("once announced, the student sees the counted score and why it is lower", async ({ page }) => {
    const mine = sub("a-late", 1, { studentId: "6407051", status: "graded", aiScore: 8, instructorScore: 8, late: true, submittedAt: "2026-03-12T12:00:00.000Z", criterionScores: { c1: 8 } });
    await open(page, AFTER_CLOSE, "a-late", [mine], [asg("a-late", "Poster", { latePolicy: POLICY, gradingFinalized: true })]);
    await expect(page.getByTestId("late-deduction")).toContainText("Work scored 8 − late deduction 4");
    await expect(page.locator("p.text-2xl", { hasText: "4/9" })).toHaveCount(1);
  });
});

test.describe("Calibration offers only assignments that are open for grading", () => {
  const ASSIGNMENTS = [asg("a-late", "Poster", { latePolicy: POLICY })];
  const AI = [1, 2, 3].map((n) => sub("a-late", n, { status: "graded", aiScore: 5 + n, aiCriterionScores: { c1: 5 + n } }));

  test("while late work is still accepted it is not offered; after the close date, it is", async ({ page }) => {
    await seed(page, LATE_DAY_2, { assignments: ASSIGNMENTS, subs: AI });
    await page.goto(`${BASE}/teacher/courses/c-gw/calibration`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#cal-asg")).toHaveCount(0);

    const page2 = await page.context().newPage();
    await seed(page2, AFTER_CLOSE, { assignments: ASSIGNMENTS, subs: AI });
    await page2.goto(`${BASE}/teacher/courses/c-gw/calibration`);
    await expect(page2.locator("#cal-asg option")).toHaveText(["Poster"]);
  });
});
