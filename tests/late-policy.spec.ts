import { test, expect, Page } from "@playwright/test";

import { BASE } from "./base";
import { buildScoreBook } from "../src/lib/scoreBook";
import { computeCategoryGradeRows } from "../src/lib/gradingCategories";
import { computeAssignmentStats } from "../src/lib/examStats";
import type { Assignment, LatePolicy, Submission } from "../src/lib/assignments";

// 21/10/2569 — the teacher sets, per assignment, the day work really closes and what a late hand-in costs.
// The rule itself (days, tiers, caps) is in grading-window.spec.ts; this file covers the form and where the counted score shows up.

const NOW = "2026-01-01T00:00:00.000Z";
const COURSE = {
  id: "c-lp", name: "Web Design", description: "", status: "active", source: "manual",
  coverColor: "#2DD4BF", iconColor: "#2DD4BF", courseTemplateId: "ct-lp", term: 1, academicYear: 2569,
  sectionNumber: "1", code: "01076098", schedule: "-", room: "-", createdAt: NOW, updatedAt: NOW,
};
const POLICY: LatePolicy = { closeDate: "2099-12-31", mode: "perDay", unit: "percent", amount: 10, cap: 30 };
const lv = (label: string) => ({ label, description: `${label} wording` });
const ASSIGNMENT = {
  id: "a-lp", courseId: "c-lp", name: "Poster", description: "", dueDate: "2099-12-28", maxPoints: 10, submissionType: "individual", maxGroupSize: null,
  acceptsFiles: true, fileTypes: ["pdf"], rubricIds: ["r-lp"], createdAt: NOW, updatedAt: NOW,
};
const RUBRIC = {
  id: "r-lp", assignmentId: "a-lp", name: "Rubric", createdAt: NOW, updatedAt: NOW,
  criteria: [{ id: "c1", name: "C1 · Design / การออกแบบ", description: "", maxPoints: 10, weight: 100, levels: [lv("A"), lv("B"), lv("C"), lv("D")] }],
};

async function seedTeacher(page: Page, assignments: unknown[] = []) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem("lp_seeded")) return;
    sessionStorage.setItem("lp_seeded", "1");
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak@kmitl.ac.th", role: "teacher" }));
    localStorage.setItem("hwai_courses_v2", JSON.stringify([d.course]));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.assignments));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.assignments.length ? [d.rubric] : []));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify([]));
  }, { course: COURSE, assignments, rubric: RUBRIC });
}
const storedAssignments = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]") as { latePolicy?: unknown }[]);

test.describe("New Assignment — late work", () => {
  test.beforeEach(async ({ page }) => { await seedTeacher(page); });
  const open = async (page: Page) => {
    await page.goto(`${BASE}/teacher/courses/c-lp/assignments/new`);
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("เช่น รายงานการวิจัยผู้ใช้").fill("Landing page");
  };

  test("off by default: nothing to configure, and nothing is stored", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await expect(page.getByRole("button", { name: "Accept late work" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#late-close")).toHaveCount(0);
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    expect((await storedAssignments(page))[0].latePolicy).toBeUndefined();
  });

  test("the switch needs a due date first; turning it on proposes the next day and shows what each late day costs", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("button", { name: "Accept late work" })).toBeDisabled();
    await page.locator('input[type="date"]').fill("2099-12-28");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await expect(page.locator("#late-close")).toHaveValue("2099-12-29");
    const preview = page.getByTestId("late-preview");
    await expect(preview).toContainText("1 day late");
    await expect(preview).toContainText("−10 → at most 90");                 // 10% of the 100 points of the starting rubric
    await page.locator("#late-close").fill("2099-12-31");
    await expect(preview.locator("li")).toHaveCount(3);                      // three late days are covered
    await expect(preview).toContainText("3 days late");
    await expect(preview).toContainText("−30 → at most 70");
  });

  test("a closing date that is not after the due date blocks Create and says why", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await page.locator("#late-close").fill("2099-12-28");
    await expect(page.getByTestId("late-close-error")).toContainText("must be after the due date");
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeDisabled();
    await page.locator("#late-close").fill("2099-12-30");
    await expect(page.getByTestId("late-close-error")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeEnabled();
  });

  test("every style can be chosen and is saved with only its own fields", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await page.locator("#late-close").fill("2099-12-31");

    await page.getByRole("radio", { name: /By delay/ }).click();
    await expect(page.getByTestId("late-tiers").locator("input")).toHaveCount(6);        // three starting tiers, two numbers each
    await page.getByRole("button", { name: "+ Add a tier" }).click();
    await expect(page.getByTestId("late-tiers").locator("input")).toHaveCount(8);
    await page.getByRole("button", { name: "Remove tier 4" }).click();
    await page.getByLabel("Tier 1 amount").fill("5");
    await page.getByRole("radio", { name: "Points" }).click();

    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    const policy = (await storedAssignments(page))[0].latePolicy as LatePolicy;
    expect(policy).toEqual({ closeDate: "2099-12-31", mode: "tiers", unit: "points", tiers: [{ untilDay: 1, amount: 5 }, { untilDay: 3, amount: 30 }, { untilDay: 7, amount: 50 }] });
    await expect(page.getByTestId("late-policy-row")).toContainText("≤1 d late −5 pts");
  });

  test("one-time and no-deduction styles", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await page.locator("#late-close").fill("2099-12-30");
    await page.getByRole("radio", { name: /One-time/ }).click();
    await page.getByLabel("Amount").fill("25");
    await expect(page.getByTestId("late-preview")).toContainText("−25 → at most 75");
    await page.getByRole("radio", { name: /No deduction/ }).click();
    await expect(page.getByTestId("late-preview")).toContainText("no deduction");
    await page.getByRole("button", { name: "Create Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments\/(?!new)[^/]+$/, { timeout: 20_000 });
    expect((await storedAssignments(page))[0].latePolicy).toEqual({ closeDate: "2099-12-30", mode: "none", unit: "percent" });
  });

  test("an out-of-range amount blocks Create", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await page.getByLabel("Amount").fill("150");
    await expect(page.getByTestId("late-amount-error")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Assignment" })).toBeDisabled();
  });

  test("an exam has no late settings at all", async ({ page }) => {
    await open(page);
    await page.locator('input[type="date"]').fill("2099-12-28");
    await expect(page.getByTestId("late-policy-editor")).toHaveCount(1);
    await page.getByRole("button", { name: "Exam Assignment" }).click();
    await expect(page.getByTestId("late-policy-editor")).toHaveCount(0);
  });
});

test.describe("Edit Assignment — late work", () => {
  test("the saved policy is loaded, can be changed, and turning it off removes it", async ({ page }) => {
    await seedTeacher(page, [{ ...ASSIGNMENT, latePolicy: POLICY }]);
    await page.goto(`${BASE}/teacher/courses/c-lp/assignments/a-lp/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Accept late work" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#late-close")).toHaveValue("2099-12-31");
    await expect(page.getByLabel("Maximum deduction")).toHaveValue("30");
    await page.getByRole("radio", { name: /One-time/ }).click();
    await page.getByLabel("Amount").fill("20");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect.poll(async () => (await storedAssignments(page))[0].latePolicy).toEqual({ closeDate: "2099-12-31", mode: "flat", unit: "percent", amount: 20 });

    await page.goto(`${BASE}/teacher/courses/c-lp/assignments/a-lp/edit`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Accept late work" }).click();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect.poll(async () => (await storedAssignments(page))[0].latePolicy).toBeUndefined();
  });

  test("after results are announced the settings are read-only", async ({ page }) => {
    await seedTeacher(page, [{ ...ASSIGNMENT, latePolicy: POLICY, gradingFinalized: true }]);
    await page.goto(`${BASE}/teacher/courses/c-lp/assignments/a-lp/edit`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("late-policy-locked")).toContainText("Late work loses 10% per day, up to 30%");
    await expect(page.getByTestId("late-policy-editor")).toHaveCount(0);
  });
});

// ── where the counted score shows up (pure functions behind the Score Book, Evaluation and class stats) ─────────────────────────────
const asg = (extra: Partial<Assignment> = {}): Assignment => ({
  id: "a1", courseId: "c1", name: "Poster", description: "", dueDate: "2026-03-10", maxPoints: 10, categoryId: "cat1", acceptsFiles: true, fileTypes: ["pdf"],
  submissionType: "individual", maxGroupSize: null, rubricIds: [], createdAt: NOW, updatedAt: NOW, ...extra,
});
const sub = (studentId: string, submittedAt: string, instructorScore: number | null): Submission => ({
  id: `s-${studentId}`, assignmentId: "a1", studentId, studentName: studentId, email: "", submittedAt, aiScore: null, instructorScore,
  instructorComment: "", status: instructorScore === null ? "not_graded" : "graded", updatedAt: NOW,
} as Submission);
const CATEGORY = { id: "cat1", courseId: "c1", name: "Work", weight: 100, createdAt: NOW, updatedAt: NOW };
const LATE: LatePolicy = { closeDate: "2026-03-14", mode: "perDay", unit: "points", amount: 2 };

test.describe("the counted score is used everywhere", () => {
  const students = [{ studentId: "on", name: "On Time" }, { studentId: "late", name: "Late Bird" }, { studentId: "none", name: "No Show" }];
  const submissions = [sub("on", "2026-03-10T05:00:00", 9), sub("late", "2026-03-12T05:00:00", 9)];   // the second is 2 days late: 9 − 4

  test("Score Book cells and the column average use the score after the deduction", () => {
    const book = buildScoreBook({ students, assignments: [asg({ latePolicy: LATE })], categories: [CATEGORY] as never, submissions, today: "2026-03-20" });
    const cell = (id: string) => book.rows.find((r) => r.student.studentId === id)!.cells.a1;
    expect(cell("on")).toMatchObject({ kind: "graded", score: 9 });
    expect(cell("late")).toMatchObject({ kind: "graded", score: 5 });
    expect(book.columnAverages.a1).toBeCloseTo(((9 + 5) / 2 / 10) * 100);
  });

  test("a student who has not submitted is Missing only after the closing date, not while late work is still welcome", () => {
    const build = (today: string) => buildScoreBook({ students, assignments: [asg({ latePolicy: LATE })], categories: [CATEGORY] as never, submissions, today });
    const none = (today: string) => build(today).rows.find((r) => r.student.studentId === "none")!.cells.a1.kind;
    expect(none("2026-03-12")).toBe("none");          // past the due date but inside the late period
    expect(none("2026-03-14")).toBe("none");          // the closing day itself
    expect(none("2026-03-15")).toBe("missing");
    const noPolicy = buildScoreBook({ students, assignments: [asg()], categories: [CATEGORY] as never, submissions, today: "2026-03-12" });
    expect(noPolicy.rows.find((r) => r.student.studentId === "none")!.cells.a1.kind).toBe("missing");
  });

  test("the student's category grade counts the deducted score, and an assignment without a policy is untouched", () => {
    const rows = (a: Assignment) => computeCategoryGradeRows([CATEGORY as never], [a], submissions, "late")[0];
    expect(rows(asg({ latePolicy: LATE })).earnedPoints).toBe(5);
    expect(rows(asg()).earnedPoints).toBe(9);
  });

  test("the class numbers a student sees after the announcement use the same scores", () => {
    const stats = computeAssignmentStats(asg({ latePolicy: LATE, gradingFinalized: true }), submissions);
    expect(stats!.scores).toEqual([9, 5]);
    expect(stats!.mean).toBe(7);
  });
});


// ── console command [25]: late policies + late hand-ins on the UX/UI mock ───────────────────────────────────────────────────────────────────
import fs from "node:fs";
import { finalScoreOf, latePenaltyOf } from "../src/lib/assignments";

test.describe("console command [25]", () => {
  const CMD = (() => {
    const doc = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
    const i = doc.findIndex((l) => l.startsWith("[25]"));
    const line = doc.find((l, k) => k > i && l.startsWith("(()=>{const get="));
    if (i < 0 || !line) throw new Error("command [25] not found");
    return line.replace(/;\s*$/, "");
  })();
  const ux = JSON.parse(fs.readFileSync("public/mock-data/student-uxui-mockup-en.json", "utf8"));

  async function load(page: import("@playwright/test").Page, demo?: string) {
    await page.goto(`${BASE}/login`);
    await page.evaluate(({ asg, subs, demo }) => {
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(asg));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
      if (demo) localStorage.setItem("hwai_demo_student", JSON.stringify({ studentId: demo }));
    }, { asg: ux.assignments, subs: ux.submissions, demo });
  }
  async function run(page: import("@playwright/test").Page) {
    const reloaded = page.waitForEvent("load");
    await page.evaluate(`(${CMD})`);
    await reloaded;
  }
  const read = (page: import("@playwright/test").Page, k: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), k);

  test("five individual assignments get a policy; marks are untouched; some hand-ins become late and cost points", async ({ page }) => {
    await load(page);
    await run(page);
    const asg = await read(page, "hwai_assignments_v1") as Assignment[];
    const subs = await read(page, "hwai_submissions_v1") as Submission[];
    const withPolicy = asg.filter((a) => a.latePolicy).map((a) => a.id).sort();
    expect(withPolicy).toEqual(["a-uxui-13", "a-uxui-16", "a-uxui-18", "a-uxui-3", "a-uxui-4"]);
    for (const a of asg.filter((x) => x.latePolicy)) expect(a.latePolicy!.closeDate > a.dueDate!, a.id).toBe(true);
    // nobody's mark changed
    const was = new Map<string, Submission>(ux.submissions.map((s: Submission) => [s.id, s]));
    for (const s of subs) { expect(s.instructorScore, s.id).toBe(was.get(s.id)!.instructorScore); expect(s.aiScore, s.id).toBe(was.get(s.id)!.aiScore); }
    // late hand-ins: inside the accepted period, and the demo student is two days late on UI design
    const byId = new Map(asg.map((a) => [a.id, a]));
    const mine5 = new Set(withPolicy);
    const late = subs.filter((s) => s.late && mine5.has(s.assignmentId));
    expect(late.length).toBeGreaterThan(10);
    for (const s of late) {
      const a = byId.get(s.assignmentId)!;
      expect(a.latePolicy, s.id).toBeTruthy();
      expect(s.submittedAt.slice(0, 10) > a.dueDate! && s.submittedAt.slice(0, 10) <= a.latePolicy!.closeDate, s.id).toBe(true);
    }
    const me = subs.find((s) => s.assignmentId === "a-uxui-13" && s.studentId === "69070101")!;
    expect(me.late).toBe(true);
    expect(latePenaltyOf(byId.get("a-uxui-13")!, me)).toBe(2);                                  // 10% × 2 days of 10
    if (me.instructorScore !== null) expect(finalScoreOf(byId.get("a-uxui-13")!, me)).toBe(Math.max(0, me.instructorScore - 2));
    // the "no deduction" one costs nothing
    for (const s of subs.filter((x) => x.assignmentId === "a-uxui-4" && x.late)) expect(latePenaltyOf(byId.get("a-uxui-4")!, s)).toBe(0);
    // groups and the other courses are left alone
    expect(asg.filter((a) => a.submissionType === "group").every((a) => !a.latePolicy)).toBe(true);
  });

  test("running it twice gives exactly the same data", async ({ page }) => {
    await load(page);
    await run(page);
    const once = [await read(page, "hwai_assignments_v1"), await read(page, "hwai_submissions_v1")];
    await run(page);
    expect([await read(page, "hwai_assignments_v1"), await read(page, "hwai_submissions_v1")]).toEqual(once);
  });

  test("it follows the demo student that [24] chose", async ({ page }) => {
    const other = ux.submissions.find((s: Submission) => s.assignmentId === "a-uxui-13" && s.studentId !== "69070101").studentId;
    await load(page, other);
    await run(page);
    const subs = await read(page, "hwai_submissions_v1") as Submission[];
    expect(subs.find((s) => s.assignmentId === "a-uxui-13" && s.studentId === other)!.late).toBe(true);
  });

  test("without the UX/UI course it says so and changes nothing", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => localStorage.setItem("hwai_assignments_v1", "[]"));
    const said: string[] = [];
    page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
    await page.evaluate(`(${CMD})`);
    expect(said.join()).toContain("รัน [16] ก่อน");
  });

  test("the Score Book shows the counted score for a late hand-in", async ({ page }) => {
    await load(page);
    await run(page);
    const subs = await read(page, "hwai_submissions_v1") as Submission[];
    const asg = await read(page, "hwai_assignments_v1") as Assignment[];
    const a = asg.find((x) => x.id === "a-uxui-13")!;
    const lateOne = subs.find((s) => s.assignmentId === "a-uxui-13" && s.late && s.status === "graded" && (s.instructorScore ?? 0) > 3)!;
    const book = buildScoreBook({ students: [{ studentId: lateOne.studentId, name: "x y" }], assignments: [a], categories: [], submissions: subs, today: "2027-01-01" });
    const cell = book.rows[0].cells["a-uxui-13"];
    expect(cell.kind).toBe("graded");
    if (cell.kind === "graded") expect(cell.score).toBe((lateOne.instructorScore ?? 0) - latePenaltyOf(a, lateOne));
  });
});
