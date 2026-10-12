import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

// 11/10/2569 — "Grading method" per assignment. On the course Grading list the button that starts grading IS the choice:
// "Grade with AI" (as before) or "Grade manually" (no AI at all). Manual hides every AI figure and the Re-grade button,
// sends work that only the AI scored back to "Not graded" (anything the teacher scored stays), is locked once the results
// are announced, and is the only option for an assignment that takes no files. The assignment's own Grading page only shows it.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-gm", name: "Programming", description: "", status: "active",
  coverColor: "#0F766E", courseTemplateId: "ct-gm", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076112", schedule: "Mon", room: "811", createdAt: NOW, updatedAt: NOW,
};
const TEACHER = { id: "t-gm", title: "Dr.", name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher", status: "active", courseIds: ["c-gm"] };
const assignment = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, courseId: "c-gm", name, description: "", dueDate: "2099-12-31", maxPoints: 100,
  acceptsFiles: true, fileTypes: ["pdf"], submissionType: "individual", maxGroupSize: null, rubricIds: [],
  createdAt: NOW, updatedAt: NOW, ...extra,
});
const sub = (id: string, assignmentId: string, studentId: string, status: string, ai: number | null, teacher: number | null) => ({
  id, assignmentId, studentId, studentName: `Student ${studentId}`, email: `${studentId}@kmitl.ac.th`,
  submittedAt: "2026-01-05T10:00:00.000Z", fileUrl: null, aiScore: ai, instructorScore: teacher,
  instructorComment: "", externalUseConsent: false, status, updatedAt: "2026-01-05T10:00:00.000Z",
});
const ASSIGNMENTS = [
  assignment("a-mix", "Mixed work"),
  assignment("a-done", "Announced work", { gradingFinalized: true }),
  assignment("a-nofile", "Reflection", { acceptsFiles: false, fileTypes: [] }),
  assignment("a-empty", "Not handed in yet"),
  assignment("a-team", "Team project", { submissionType: "group", maxGroupSize: 2 }),
  assignment("a-ann-open", "Announced, one left", { gradingFinalized: true }),
  assignment("a-exam", "Midterm", { isExam: true, acceptsFiles: false, fileTypes: [], dueDate: undefined }),
];
const SUBMISSIONS = [
  sub("m1", "a-mix", "64070701", "graded", 80, null),         // graded by the AI only
  sub("m2", "a-mix", "64070702", "need_review", 70, null),    // AI scored, waiting for review
  sub("m3", "a-mix", "64070703", "graded", 70, 90),           // the teacher's own score (edited)
  sub("m4", "a-mix", "64070704", "not_graded", null, null),
  sub("d1", "a-done", "64070701", "graded", 80, null),
  sub("n1", "a-nofile", "64070701", "not_graded", null, null),
  { ...sub("t1", "a-team", "64070701", "not_graded", null, null), groupId: "g-1" },
  { ...sub("t2", "a-team", "64070702", "not_graded", null, null), groupId: "g-1" },
  sub("o1", "a-ann-open", "64070701", "graded", 80, null),
  sub("o2", "a-ann-open", "64070702", "not_graded", null, null),
];
const ROSTER = ["64070701", "64070702", "64070703", "64070704"].map((studentId, i) => ({
  id: `r-${i}`, courseId: "c-gm", studentId, firstName: "Student", lastName: studentId, email: `${studentId}@kmitl.ac.th`,
  cohort: "CE64", sequenceNumber: i + 1, enrollmentStatus: "enrolled",
}));

async function open(page: Page, path = "/grading") {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("gm_seeded")) return;     // seed once so changes made in the test survive navigation
    sessionStorage.setItem("gm_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify([d.teacher]));
    localStorage.setItem("hwai_students_v1", JSON.stringify(d.roster));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify([]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify([]));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.submissions));
    localStorage.setItem("hwai_student_groups_v1", JSON.stringify([{ id: "g-1", assignmentId: "a-team", courseId: "c-gm", name: "Team One", memberStudentIds: ["64070701", "64070702"], createdAt: "x", updatedAt: "x" }]));
  }, { course: COURSE, teacher: TEACHER, roster: ROSTER, assignments: ASSIGNMENTS, submissions: SUBMISSIONS });
  await page.goto(`${BASE}/teacher/courses/c-gm${path}`);
  await page.waitForLoadState("networkidle");
}

const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const choose = (page: Page, name: string, how: "Grade with AI" | "Grade manually") => row(page, name).getByRole("button", { name: how });
const onAssignmentPage = (page: Page, id: string) => expect(page).toHaveURL(new RegExp(`/teacher/courses/c-gm/assignments/${id}/grading$`));
const stored = (page: Page) => page.evaluate(() => ({
  subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as { id: string; status: string; aiScore: number | null; instructorScore: number | null }[],
  asg: JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]") as { id: string; gradingMode?: string }[],
}));

test.describe("Grading method — the button that starts grading is the choice", () => {
  test("a row with work to grade offers both ways in place of a single Start Grading button", async ({ page }) => {
    await open(page);
    await expect(choose(page, "Mixed work", "Grade with AI")).toBeVisible();
    await expect(choose(page, "Mixed work", "Grade manually")).toBeVisible();
    await expect(row(page, "Mixed work").getByRole("link", { name: "Start Grading" })).toHaveCount(0);
    // AI-assisted is the start: its button is the filled one
    await expect(choose(page, "Mixed work", "Grade with AI")).toHaveClass(/accent-solid/);
    await expect(choose(page, "Mixed work", "Grade manually")).not.toHaveClass(/accent-solid/);
    // nothing to choose for an exam, an assignment with no files, or one still waiting for submissions
    await expect(row(page, "Not handed in yet")).toContainText("Awaiting submissions");
    await expect(row(page, "Not handed in yet").getByRole("button")).toHaveCount(0);
  });

  test("Grade with AI on work that is already scored just opens it, in AI-assisted mode", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade with AI").click();
    await onAssignmentPage(page, "a-mix");
    await expect(page.getByTestId("grading-mode-note")).toContainText("AI-assisted");
    await expect(page.getByRole("tab", { name: /Needs review/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Re-grade/ })).toHaveCount(4);
    await expect(page.getByText("AI: 70")).toBeVisible();
    expect((await stored(page)).asg.find((a) => a.id === "a-mix")?.gradingMode).toBeUndefined();
  });

  test("Grade manually asks first and says what happens; Not yet changes nothing and stays on the list", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade manually").click();
    const dialog = page.getByRole("dialog", { name: "Switch to manual grading?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2 submissions scored only by the AI will go back to “Not graded”");   // m1 and m2
    await expect(dialog).toContainText("Scores you set yourself stay");
    await dialog.getByRole("button", { name: "Not yet" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/teacher\/courses\/c-gm\/grading$/);
    expect((await stored(page)).asg.find((a) => a.id === "a-mix")?.gradingMode).toBeUndefined();
  });

  test("Grade manually: AI results are cleared, the teacher's own score stays, and the assignment page shows no AI figure or Re-grade", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade manually").click();
    await page.getByRole("dialog", { name: "Switch to manual grading?" }).getByRole("button", { name: "Switch and grade" }).click();
    await onAssignmentPage(page, "a-mix");

    const after = await stored(page);
    expect(after.asg.find((a) => a.id === "a-mix")?.gradingMode).toBe("manual");
    for (const id of ["m1", "m2"]) expect(after.subs.find((s) => s.id === id)).toMatchObject({ status: "not_graded", aiScore: null, instructorScore: null });
    expect(after.subs.find((s) => s.id === "m3")).toMatchObject({ status: "graded", instructorScore: 90 });
    expect(after.subs.find((s) => s.id === "d1")?.aiScore).toBe(80);                    // another assignment is untouched

    await expect(page.getByTestId("grading-mode-note")).toContainText("Manual — no AI");
    await expect(page.getByRole("button", { name: /Re-grade/ })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Re-grade" })).toHaveCount(0);
    await expect(page.getByText(/AI: \d/)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Needs review/ })).toHaveCount(0);       // that status only comes from the AI
    await expect(page.getByRole("tab", { name: /Not graded\s*3/ })).toBeVisible();      // m1, m2, m4
    await expect(page.getByRole("tab", { name: /^Graded\s*1/ })).toBeVisible();         // m3, scored by the teacher
  });

  test("Manual: the Grade screen shows no AI confidence, AI feedback or Feedback-to-AI box", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade manually").click();
    await page.getByRole("dialog").getByRole("button", { name: "Switch and grade" }).click();
    await onAssignmentPage(page, "a-mix");
    await page.getByRole("link", { name: "Grade" }).first().click();
    await expect(page.getByText("Graded by hand — no AI on this assignment")).toBeVisible();
    await expect(page.getByText(/AI Confidence/i)).toHaveCount(0);
    await expect(page.getByText("AI Feedback")).toHaveCount(0);
    await expect(page.getByText("Feedback to AI")).toHaveCount(0);
  });

  test("once manual, the filled button follows; Grade with AI switches back with no popup and the AI figures return", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade manually").click();
    await page.getByRole("dialog").getByRole("button", { name: "Switch and grade" }).click();
    await onAssignmentPage(page, "a-mix");
    await page.getByTestId("grading-mode-note").getByRole("link", { name: "change it on the Grading list" }).click();
    await expect(choose(page, "Mixed work", "Grade manually")).toHaveClass(/accent-solid/);        // the method in use is the filled one
    await choose(page, "Mixed work", "Grade with AI").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await onAssignmentPage(page, "a-mix");
    await expect(page.getByTestId("grading-mode-note")).toContainText("AI-assisted");
    await expect(page.getByRole("button", { name: /Re-grade/ })).toHaveCount(4);
    expect((await stored(page)).asg.find((a) => a.id === "a-mix")?.gradingMode).toBe("ai");
  });

  test("with nothing the AI scored, Grade manually needs no confirmation", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade manually").click();
    await page.getByRole("dialog").getByRole("button", { name: "Switch and grade" }).click();
    await page.getByTestId("grading-mode-note").getByRole("link", { name: "change it on the Grading list" }).click();
    await choose(page, "Mixed work", "Grade manually").click();                           // nothing AI-only is left → straight in
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await onAssignmentPage(page, "a-mix");
  });

  test("nothing is graded until the teacher presses: a not-graded submission stays without a score", async ({ page }) => {
    await open(page);
    const before = await stored(page);
    expect(before.subs.filter((x) => x.id.startsWith("m") || x.id.startsWith("t")).filter((x) => x.status === "not_graded").map((x) => x.id).sort()).toEqual(["m4", "t1", "t2"]);
    await expect(choose(page, "Mixed work", "Grade with AI")).toContainText("Grade with AI (1)");   // m4 only: m1 / m2 / m3 already carry a score
  });

  test("Grade with AI sends every waiting submission of THAT assignment to the AI, then opens it for review", async ({ page }) => {
    await open(page);
    const btn = choose(page, "Mixed work", "Grade with AI");
    await expect(btn).toHaveAttribute("title", /Sends the 1 not-graded submission to the AI/);
    await btn.click();
    await expect(row(page, "Mixed work").getByRole("button").first()).toContainText("AI grading 1");   // busy while the AI works
    await expect(row(page, "Mixed work").getByRole("button", { name: "Grade manually" })).toBeDisabled();
    await onAssignmentPage(page, "a-mix");

    const after = await stored(page);
    const m4 = after.subs.find((x) => x.id === "m4")!;
    expect(m4.aiScore).not.toBeNull();
    expect(m4.instructorScore).toBeNull();
    expect(["graded", "need_review"]).toContain(m4.status);
    // what was already scored is untouched, and so are the other assignments' waiting submissions
    expect(after.subs.find((x) => x.id === "m1")).toMatchObject({ status: "graded", aiScore: 80 });
    expect(after.subs.find((x) => x.id === "m3")).toMatchObject({ status: "graded", aiScore: 70, instructorScore: 90 });
    expect(after.subs.find((x) => x.id === "n1")).toMatchObject({ status: "not_graded", aiScore: null });
    expect(after.subs.find((x) => x.id === "t1")).toMatchObject({ status: "not_graded", aiScore: null });
    // the page now shows the AI's score for it
    await expect(page.getByText("AI: 70")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Not graded\s*0/ })).toBeVisible();
  });

  test("the AI's answer is the same every time for the same submission", async ({ page }) => {
    await open(page);
    await choose(page, "Mixed work", "Grade with AI").click();
    await onAssignmentPage(page, "a-mix");
    const first = (await stored(page)).subs.find((x) => x.id === "m4")!.aiScore;
    // reset it and send again: same score
    await page.evaluate(() => {
      const subs = JSON.parse(localStorage.getItem("hwai_submissions_v1")!);
      for (const s of subs) if (s.id === "m4") { s.aiScore = null; s.status = "not_graded"; }
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
    });
    await page.reload();
    await page.getByTestId("grading-mode-note").getByRole("link", { name: "change it on the Grading list" }).click();
    await choose(page, "Mixed work", "Grade with AI").click();
    await onAssignmentPage(page, "a-mix");
    expect((await stored(page)).subs.find((x) => x.id === "m4")!.aiScore).toBe(first);
  });

  test("a team is graded once: every member of the team gets the same AI score", async ({ page }) => {
    await open(page);
    await expect(choose(page, "Team project", "Grade with AI")).toContainText("Grade with AI (1)");    // one team, not two students
    await choose(page, "Team project", "Grade with AI").click();
    await onAssignmentPage(page, "a-team");
    const after = await stored(page);
    const [t1, t2] = [after.subs.find((x) => x.id === "t1")!, after.subs.find((x) => x.id === "t2")!];
    expect(t1.aiScore).not.toBeNull();
    expect(t2.aiScore).toBe(t1.aiScore);
    expect(t2.status).toBe(t1.status);
  });

  test("Grade manually sends nothing to the AI", async ({ page }) => {
    await open(page);
    await choose(page, "Team project", "Grade manually").click();                          // nothing AI-scored there → straight in
    await onAssignmentPage(page, "a-team");
    const after = await stored(page);
    for (const id of ["t1", "t2"]) expect(after.subs.find((x) => x.id === id)).toMatchObject({ status: "not_graded", aiScore: null });
    expect(after.asg.find((a) => a.id === "a-team")?.gradingMode).toBe("manual");
  });

  test("announced work keeps its method: one Start Grading button and the reason", async ({ page }) => {
    await open(page);
    const r = row(page, "Announced, one left");
    await expect(r.getByRole("link", { name: "Start Grading" })).toBeVisible();
    await expect(r.getByRole("button", { name: "Grade manually" })).toHaveCount(0);
    await expect(r.getByTestId("grading-mode-locked")).toContainText("results announced");
  });

  test("an assignment that takes no files is manual only, and says why", async ({ page }) => {
    await open(page);
    const r = row(page, "Reflection");
    await expect(r.getByRole("link", { name: "Start Grading" })).toBeVisible();
    await expect(r.getByRole("button", { name: "Grade with AI" })).toHaveCount(0);
    await expect(r.getByTestId("grading-mode-locked")).toContainText("takes no files");
    await r.getByRole("link", { name: "Start Grading" }).click();
    await expect(page.getByTestId("grading-mode-note")).toContainText("Manual — no AI");
    await expect(page.getByTestId("grading-mode-note").getByRole("link")).toHaveCount(0);   // nothing to change back to
  });
});
