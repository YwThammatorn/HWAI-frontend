import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";
const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

// 3/10/2569 — the c-mock-1 class ("การเขียนโปรแกรมคอมพิวเตอร์", 01076112 sec 1) grew from 3 to 42 students with
// realistic scores (console command [15] in test-data/seed-commands.txt). These guard the data, not the screens.

type Roster = { id: string; courseId: string; studentId: string; sequenceNumber: number; enrollmentStatus: string };
type Sub = { id: string; assignmentId: string; studentId: string; status: string; aiScore: number | null; instructorScore: number | null; instructorComment: string };
type Cohort = { id: string; studentId: string; program: string; status: string };

for (const sfx of ["", "-en"]) {
  test.describe(`c-mock-1 class mock (${sfx ? "English" : "Thai"} files)`, () => {
    const flow = rd(`student-flow-mockup${sfx}.json`);
    const roster = flow.courseStudents as Roster[];
    const subs = flow.submissions as Sub[];
    const maxOf = new Map<string, number>(flow.assignments.map((a: { id: string; maxPoints: number }) => [a.id, a.maxPoints]));

    test("42 enrolled students, numbered 1–42 in student-id order, every one in the cohort", () => {
      expect(roster).toHaveLength(42);
      expect(new Set(roster.map((r) => r.studentId)).size).toBe(42);
      expect(new Set(roster.map((r) => r.id)).size).toBe(42);
      expect(roster.map((r) => r.sequenceNumber)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
      expect(roster.map((r) => r.studentId)).toEqual([...roster.map((r) => r.studentId)].sort());
      expect(roster.every((r) => r.courseId === "c-mock-1" && r.enrollmentStatus === "enrolled")).toBe(true);
      const cohort = flow.cohortStudents as Cohort[];
      const all = rd(`students-mockup${sfx}.json`) as Cohort[];
      for (const r of roster) {
        const c = cohort.find((x) => x.studentId === r.studentId);
        expect(c, r.studentId).toBeDefined();
        expect(all.find((x) => x.id === c!.id), r.studentId).toEqual(c);   // the admin cohort has the very same record
        expect(c!.status).toBe("active");
        expect(r.studentId.startsWith("69")).toBe(true);                    // first-years, taking the first-year course
      }
      expect(new Set(roster.map((r) => cohort.find((x) => x.studentId === r.studentId)!.program))).toEqual(new Set(["CE"]));   // one section = one program: this is a CE 2569 section
    });

    test("the 10 students the teacher CSV-import test relies on are still not enrolled, and the sample CSVs still don't clash", () => {
      const enrolled = new Set(roster.map((r) => r.studentId));
      for (const id of ["69070104", "69070105", "69070106", "69070107", "69070108", "68020101", "68020102", "68020103", "68020104", "67010101"]) expect(enrolled.has(id), id).toBe(false);
      const csvIds = new Set(["test-data/students_sample.csv", "test-data/course-import-test.csv"].flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/\b\d{8}\b/g)].map((m) => m[0])));
      const original13 = new Set(["69070101", "69070102", "69070103", "69070104", "69070105", "69070106", "69070107", "69070108", "68020101", "68020102", "68020103", "68020104", "67010101"]);
      const cohort = rd(`students-mockup${sfx}.json`) as Cohort[];
      // every student added after the original [5] / [12] set must stay clear of the ids the CSV tests import as "new"
      for (const c of cohort.filter((x) => Number(x.id.replace("cs-mock-", "")) > 57)) expect(csvIds.has(c.studentId), c.studentId).toBe(false);
      expect(original13.size).toBe(13);
    });

    test("submissions: one per student per assignment, only by enrolled students, scores inside each maximum", () => {
      const enrolled = new Set(roster.map((r) => r.studentId));
      expect(new Set(subs.map((s) => s.id)).size).toBe(subs.length);
      expect(new Set(subs.map((s) => `${s.assignmentId}/${s.studentId}`)).size).toBe(subs.length);
      for (const s of subs) {
        expect(enrolled.has(s.studentId), s.id).toBe(true);
        const max = maxOf.get(s.assignmentId)!;
        expect(max, s.id).toBeGreaterThan(0);
        if (s.status === "graded") { expect(Number.isInteger(s.instructorScore), s.id).toBe(true); expect(s.instructorScore!).toBeGreaterThanOrEqual(0); expect(s.instructorScore!).toBeLessThanOrEqual(max); }
        if (s.status === "need_review") { expect(s.instructorScore, s.id).toBeNull(); expect(s.aiScore, s.id).not.toBeNull(); }
        if (s.status === "not_graded") { expect(s.instructorScore, s.id).toBeNull(); expect(s.aiScore, s.id).toBeNull(); }
      }
    });

    test("the midterm looks like a real class: everyone scored, a spread, a few lows and highs, nobody perfect", () => {
      const sc = subs.filter((s) => s.assignmentId === "a-mock-5").map((s) => s.instructorScore!);
      expect(sc).toHaveLength(42);
      const mean = sc.reduce((a, b) => a + b, 0) / sc.length;
      const sd = Math.sqrt(sc.reduce((a, b) => a + (b - mean) ** 2, 0) / (sc.length - 1));
      expect(mean).toBeGreaterThan(30); expect(mean).toBeLessThan(38);       // about two thirds of 50
      expect(sd).toBeGreaterThan(5); expect(sd).toBeLessThan(10);
      expect(Math.min(...sc)).toBeLessThan(25);                               // some struggled
      expect(Math.max(...sc)).toBeGreaterThanOrEqual(45); expect(Math.max(...sc)).toBeLessThan(50);
      // the three original students keep their scores
      for (const [id, v] of [["69070101", 42], ["69070102", 38], ["69070103", 45]] as const) expect(subs.find((s) => s.assignmentId === "a-mock-5" && s.studentId === id)!.instructorScore).toBe(v);
    });

    test("not everyone hands everything in; the mini-project is fully graded but NOT announced — the one assignment ready for \"Finish & announce\"", () => {
      const count = (a: string) => subs.filter((s) => s.assignmentId === a).length;
      for (const a of ["a-mock-4", "a-mock-6", "a-mock-8"]) expect(count(a), a).toBeLessThan(42);
      expect(count("a-mock-2")).toBeGreaterThan(30);
      expect(subs.filter((s) => s.assignmentId === "a-mock-2").every((s) => s.status === "graded")).toBe(true);
      expect(flow.assignments.find((a: { id: string }) => a.id === "a-mock-2").gradingFinalized).toBeFalsy();
      // across the whole class, exactly one assignment is "everything graded, results not announced yet"
      const ready = flow.assignments.filter((a: { id: string; gradingFinalized?: boolean }) => {
        const mine = subs.filter((s) => s.assignmentId === a.id);
        return !a.gradingFinalized && mine.length > 0 && mine.every((s) => s.status === "graded");
      }).map((a: { id: string }) => a.id);
      expect(ready).toEqual(["a-mock-2"]);
      // only assignments that are genuinely complete are announced; the ones with work left are not
      const announced = flow.assignments.filter((a: { id: string; gradingFinalized?: boolean }) => a.id.startsWith("a-mock-") && a.gradingFinalized).map((a: { id: string }) => a.id);
      expect(announced).toEqual(["a-mock-4", "a-mock-5"]);
      for (const a of announced) {
        const mine = subs.filter((s) => s.assignmentId === a);
        expect(mine.every((s) => s.status === "graded"), a).toBe(true);
      }
      expect(subs.some((s) => s.assignmentId === "a-mock-2" && ["69070101", "69070102", "69070103"].includes(s.studentId))).toBe(false);   // the demo students keep their "overdue, not submitted" state
    });
  });
}

test("Thai and English class mocks hold the same numbers (only comments are translated)", () => {
  const th = rd("student-flow-mockup.json"), en = rd("student-flow-mockup-en.json");
  expect(en.courseStudents).toEqual(th.courseStudents);
  expect(en.cohortStudents).toEqual(th.cohortStudents);
  expect(en.submissions.map((s: Sub) => ({ ...s, instructorComment: "" }))).toEqual(th.submissions.map((s: Sub) => ({ ...s, instructorComment: "" })));
  expect(rd("students-mockup-en.json")).toEqual(rd("students-mockup.json"));
});

test("public/mock-data and test-data copies stay identical", () => {
  for (const n of ["student-flow-mockup", "student-flow-mockup-en", "students-mockup", "students-mockup-en"]) {
    expect(fs.readFileSync(`public/mock-data/${n}.json`, "utf8"), n).toBe(fs.readFileSync(`test-data/${n}.json`, "utf8"));
  }
});

// The command documented as [15] is what gets pasted into the console — run that exact text.
const doc = fs.readFileSync("test-data/seed-commands.txt", "utf8");
const section15 = doc.slice(doc.indexOf("\n[15] ห้อง"), doc.indexOf("\n[4] ล้างข้อมูลทั้งหมด"));
const commands = section15.split("\n").filter((l) => l.startsWith("fetch("));

test("[15] documents a Thai and an English command", () => {
  expect(commands).toHaveLength(2);
  expect(commands[0]).toContain("student-flow-mockup.json");
  expect(commands[1]).toContain("student-flow-mockup-en.json");
});

for (const [i, label] of ["Thai", "English"].entries()) {
  test(`console command [15] (${label}) grows the class and leaves everything else alone`, async ({ page }) => {
    const history = rd(i ? "student-history-mockup-en.json" : "student-history-mockup.json");
    const flow = rd(i ? "student-flow-mockup-en.json" : "student-flow-mockup.json");
    const before = {
      cohort: [...(rd("students-mockup.json") as Cohort[]).slice(0, 57), { id: "cs-custom", studentId: "99990001", title: "นาย", firstName: "เพิ่ม", lastName: "เอง", email: "99990001@kmitl.ac.th", program: "CE", status: "active" }],
      roster: [...flow.courseStudents.slice(0, 3), ...history.courseStudents],
      subs: [...flow.submissions.slice(0, 13), ...history.submissions],
    };
    await page.goto(`${BASE}/login`);
    await page.evaluate((b) => {
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(b.cohort));
      localStorage.setItem("hwai_students_v1", JSON.stringify(b.roster));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(b.subs));
    }, before);

    const reloaded = page.waitForEvent("load");
    await page.evaluate((c) => { (0, eval)(c); }, commands[i]);
    await reloaded;

    const after = await page.evaluate(() => ({
      cohort: JSON.parse(localStorage.getItem("hwai_cohort_students_v1") ?? "[]") as Cohort[],
      roster: JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]") as Roster[],
      subs: JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]") as Sub[],
    }));
    expect(after.roster.filter((r) => r.courseId === "c-mock-1")).toHaveLength(42);
    expect(after.roster.filter((r) => r.courseId !== "c-mock-1")).toHaveLength(history.courseStudents.length);   // other courses untouched
    expect(after.subs.filter((s) => s.id.startsWith("sub-hist-"))).toHaveLength(history.submissions.length);
    expect(after.subs.filter((s) => s.id.startsWith("sub-mock-"))).toHaveLength(flow.submissions.length);
    expect(after.cohort.filter((c) => c.id !== "cs-custom")).toHaveLength(85);
    expect(after.cohort.some((c) => c.id === "cs-custom")).toBe(true);                                            // a hand-added student survives
    // running it again changes nothing
    const reloaded2 = page.waitForEvent("load");
    await page.evaluate((c) => { (0, eval)(c); }, commands[i]);
    await reloaded2;
    const again = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_students_v1") ?? "[]").length);
    expect(again).toBe(after.roster.length);
  });
}

// What the teacher actually sees after running [15]. The browser is set up like a real one: it already holds the
// c-mock-1 assignments from an OLD run of [5], in which Python / Quiz 2 / Lab 5 were flagged "announced" — so these
// tests catch a command that updates the students and scores but leaves the old "announced" flags behind.
async function browserWithOldRunThenCommand(page: Page) {
  const flow = rd("student-flow-mockup.json");
  const oldAssignments = flow.assignments.map((a: { id: string }) => (["a-mock-1", "a-mock-6", "a-mock-8"].includes(a.id) ? { ...a, gradingFinalized: true } : a));
  await page.goto(`${BASE}/login`);
  await page.evaluate(([f, courses, teachers, asg]) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(teachers));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(f.cohortStudents));
    localStorage.setItem("hwai_students_v1", JSON.stringify(f.courseStudents.slice(0, 3)));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(f.gradingCategories));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(asg));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(f.rubrics));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(f.submissions.slice(0, 13)));
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somsak", email: "somsak.c@kmitl.ac.th", role: "teacher" }));
  }, [flow, rd("courses-mockup.json"), rd("teachers-mockup.json"), oldAssignments]);
  const reloaded = page.waitForEvent("load");
  await page.evaluate((c) => { (0, eval)(c); }, commands[0]);
  await reloaded;
}

test("after [15] the stale \"announced\" flags are gone: only Quiz 1 and the midterm are announced", async ({ page }) => {
  await browserWithOldRunThenCommand(page);
  const flags = await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_assignments_v1") ?? "[]")
    .filter((a: { id: string }) => a.id.startsWith("a-mock-")).map((a: { id: string; gradingFinalized?: boolean }) => [a.id, !!a.gradingFinalized]));
  expect(Object.fromEntries(flags)).toEqual({
    "a-mock-1": false, "a-mock-2": false, "a-mock-3": false, "a-mock-4": true, "a-mock-5": true, "a-mock-6": false, "a-mock-7": false, "a-mock-8": false, "a-mock-9": false,
  });
});

test("after [15], the mini-project is ready: Finish & announce is enabled, and pressing it announces", async ({ page }) => {
  await browserWithOldRunThenCommand(page);
  await page.goto(`${BASE}/teacher/courses/c-mock-1/assignments/a-mock-2/grading`);
  await page.waitForLoadState("networkidle");
  const finishBtn = page.getByRole("button", { name: "Finish & announce" }).first();
  await expect(finishBtn).toBeEnabled();
  await expect(page.getByRole("note")).toContainText("Everything is graded");
  await finishBtn.click();
  await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Announce results" }).click();
  await expect(page.getByText("Results announced")).toBeVisible();
});

// The teacher's own story, through the real screens: Lab 5 has 2 submissions left to review. Reviewing them to 100%
// must end with a live "Finish & announce" — it must not already claim to be announced.
test("Lab 5: review the last 2 through the Grade screen → 100% → Finish & announce is live (nothing announced by itself)", async ({ page }) => {
  await browserWithOldRunThenCommand(page);
  const lab5 = `${BASE}/teacher/courses/c-mock-1/assignments/a-mock-8/grading`;
  await page.goto(lab5);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Results announced")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish & announce" })).toBeDisabled();
  await expect(page.getByRole("note")).toContainText("Grade the remaining 2 submissions");

  for (let left = 2; left > 0; left--) {
    await page.goto(lab5);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Needs review/ }).click();
    await page.getByRole("link", { name: "Grade", exact: true }).first().click();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForURL(/\/grading/);
    await page.waitForLoadState("networkidle");
    if (left > 1) await expect(page.getByRole("note")).toContainText(`remaining ${left - 1} submission`);
  }

  await page.goto(lab5);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Results announced")).toHaveCount(0);                       // still not announced by itself
  const finishBtn = page.getByRole("button", { name: "Finish & announce" }).first();
  await expect(finishBtn).toBeEnabled();                                                  // 100% graded → pressable
  await expect(page.getByRole("note")).toContainText("Everything is graded");
  await finishBtn.click();
  await page.getByRole("dialog", { name: "Announce results to students?" }).getByRole("button", { name: "Announce results" }).click();
  await expect(page.getByText("Results announced")).toBeVisible();
});
