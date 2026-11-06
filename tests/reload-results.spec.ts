import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";

import { BASE } from "./base";

// Console command [26] (21/10/2569): put every loaded course's grading results back to the mock, without touching anything the user made.
// The command is read out of test-data/seed-commands.txt, so what the user pastes is exactly what is tested.

const DOC = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/);
function command(): string {
  const i = DOC.findIndex((l) => l.startsWith("[26]"));
  const line = DOC.find((l, k) => k > i && l.startsWith("(async()=>{const L="));
  if (i < 0 || !line) throw new Error("command [26] not found");
  return line.replace(/;\s*$/, "");
}
const mock = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
const flow = mock("student-flow-mockup.json"), flowEn = mock("student-flow-mockup-en.json"), ux = mock("student-uxui-mockup.json");

type Rec = Record<string, unknown> & { id: string; assignmentId?: string; studentId?: string };
async function seed(page: Page, o: { subs: Rec[]; asg: Rec[]; rubrics: Rec[]; lang?: string; demo?: string }) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((d) => {
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(d.asg));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(d.subs));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(d.rubrics));
    if (d.lang) localStorage.setItem("hwai_lang", d.lang);
    if (d.demo) localStorage.setItem("hwai_demo_student", JSON.stringify({ studentId: d.demo }));
  }, o);
}
// the command is an async arrow function called at once: `(async()=>{...})()`
async function run(page: Page) {
  const reloaded = page.waitForEvent("load");
  await page.evaluate(`(${command()})`);
  await reloaded;
}
const read = (page: Page, k: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), k);

const mine = { id: "a-mine", courseId: "c-mock-1", name: "My own task", dueDate: "2026-12-01", maxPoints: 10, latePolicy: { closeDate: "2026-12-04", mode: "none", unit: "percent" } };
const mineSub = { id: "sub-mine", assignmentId: "a-mine", studentId: "69070101", studentName: "x", email: "x", submittedAt: "2026-12-02T00:00:00.000Z", status: "graded", instructorScore: 7, aiScore: 7 };

/** a browser where the teacher has been busy: everything un-graded, announced work reopened, a policy added, a rubric emptied, and their own task */
function messed() {
  return {
    subs: [...flow.submissions.map((s: Rec) => ({ ...s, status: "not_graded", instructorScore: null, aiScore: null, late: true })), mineSub] as Rec[],
    asg: [...flow.assignments.map((a: Rec) => ({ ...a, gradingFinalized: false, gradingMode: "manual", latePolicy: { closeDate: "2099-01-01", mode: "none", unit: "percent" } })), mine] as Rec[],
    rubrics: flow.rubrics.map((r: Rec) => ({ ...r, criteria: [] })) as Rec[],
  };
}

test("every mock result comes back, announced work is announced again, and nothing of the user's own is touched", async ({ page }) => {
  await seed(page, messed());
  await run(page);
  const subs = await read(page, "hwai_submissions_v1") as Rec[];
  const asg = await read(page, "hwai_assignments_v1") as Rec[];
  const rubrics = await read(page, "hwai_rubrics_v1") as Rec[];
  const byId = new Map(subs.map((s) => [s.id, s]));
  for (const s of flow.submissions as Rec[]) expect(byId.get(s.id), s.id).toEqual(s);
  expect(subs.filter((s) => s.assignmentId !== "a-mine")).toHaveLength(flow.submissions.length);   // no duplicates, nothing lost
  for (const a of flow.assignments as Rec[]) {
    const now = asg.find((x) => x.id === a.id)!;
    expect(now.gradingFinalized, a.id).toBe(a.gradingFinalized);
    expect(now.latePolicy, a.id).toBeUndefined();
    expect(now.gradingMode, a.id).toBe(a.gradingMode);
  }
  for (const r of flow.rubrics as Rec[]) expect(rubrics.find((x) => x.id === r.id), r.id).toEqual(r);
  expect(subs.find((s) => s.id === "sub-mine")).toEqual(mineSub);                                   // the user's own work stays
  expect(asg.find((a) => a.id === "a-mine")).toEqual(mine);                                          // with its own late policy
});

test("running it twice gives the same data", async ({ page }) => {
  await seed(page, messed());
  await run(page);
  const once = [await read(page, "hwai_assignments_v1"), await read(page, "hwai_submissions_v1"), await read(page, "hwai_rubrics_v1")];
  await run(page);
  expect([await read(page, "hwai_assignments_v1"), await read(page, "hwai_submissions_v1"), await read(page, "hwai_rubrics_v1")]).toEqual(once);
});

test("it only reloads the courses that are loaded, in the language that is set", async ({ page }) => {
  // only c-mock-1 is in the browser; the UX/UI course is not
  await seed(page, { ...messed(), lang: "en" });
  await run(page);
  const subs = await read(page, "hwai_submissions_v1") as Rec[];
  expect(subs.some((s) => (ux.submissions as Rec[]).some((u) => u.id === s.id))).toBe(false);       // UX/UI results were not added
  const english = new Map((flowEn.submissions as (Rec & { studentName: string })[]).map((s) => [s.id, s.studentName]));
  for (const s of subs.filter((x) => x.assignmentId !== "a-mine") as (Rec & { studentName: string })[]) expect(s.studentName, s.id).toBe(english.get(s.id));
});

test("with the real students loaded ([24]) the reloaded results get their names; without the file it still works", async ({ page }) => {
  const first = (flow.submissions as Rec[])[0].studentId as string;
  const real = { studentId: "66990001", title: "นาย", name: "ทดสอบ ปลอม", email: "66990001@kmitl.ac.th" };
  await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ json: { version: 1, map: { [first]: real }, demo: null } }));
  await seed(page, { ...messed(), demo: "66990001" });
  await run(page);
  const subs = await read(page, "hwai_submissions_v1") as (Rec & { studentName: string; email: string })[];
  const mapped = subs.filter((s) => s.studentId === "66990001");
  expect(mapped.length).toBeGreaterThan(0);
  expect(mapped.every((s) => s.studentName === "ทดสอบ ปลอม" && s.email === "66990001@kmitl.ac.th")).toBe(true);
  expect(subs.some((s) => s.studentId === first && s.assignmentId !== "a-mine")).toBe(false);

  await page.unroute("**/local-data/real-identities.json");
  await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ status: 404, body: "" }));
  await seed(page, { ...messed(), demo: "66990001" });
  await run(page);
  expect((await read(page, "hwai_submissions_v1") as Rec[]).filter((s) => s.assignmentId !== "a-mine")).toHaveLength(flow.submissions.length);
});

test("with nothing loaded it says so and changes nothing", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.setItem("hwai_assignments_v1", "[]"));
  const said: string[] = [];
  page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
  await page.evaluate(`(${command()})`);
  expect(said.join()).toContain("ไม่พบข้อมูล mock ที่โหลดไว้");
  expect(await read(page, "hwai_submissions_v1")).toEqual([]);
});

// ── console command [27]: bring the UX/UI course's content back after it was deleted from the browser ─────────────────────────────────────────
test.describe("console command [27]", () => {
  const cmd27 = (() => {
    const i = DOC.findIndex((l) => l.startsWith("[27]"));
    const line = DOC.find((l, k) => k > i && l.startsWith("(async()=>{const L="));
    if (i < 0 || !line) throw new Error("command [27] not found");
    return line.replace(/;\s*$/, "");
  })();
  const run27 = async (page: Page) => { const reloaded = page.waitForEvent("load"); await page.evaluate(`(${cmd27})`); await reloaded; };
  const COURSE = { id: "c-mock-4", name: "UX/UI", code: "01076355" };

  async function emptied(page: Page, extra?: { demo?: string }) {
    await page.goto(`${BASE}/login`);
    await page.evaluate(({ course, keepRoster, rosterRows, demo }) => {
      localStorage.setItem("hwai_courses_v2", JSON.stringify([course]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "a-my-uxui", courseId: "c-mock-4", name: "Mine", dueDate: "2026-12-01", maxPoints: 5 }, { id: "a-elsewhere", courseId: "c-other", name: "Other course" }]));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify([{ id: "sub-else", assignmentId: "a-elsewhere", studentId: "1" }]));
      for (const k of ["hwai_rubrics_v1", "hwai_student_groups_v1", "hwai_clos_v1", "hwai_grading_categories_v1"]) localStorage.setItem(k, "[]");
      localStorage.setItem("hwai_students_v1", JSON.stringify(keepRoster ? rosterRows : []));
      if (demo) localStorage.setItem("hwai_demo_student", JSON.stringify({ studentId: demo }));
    }, { course: COURSE, keepRoster: false, rosterRows: [], demo: extra?.demo });
  }
  const rd = (page: Page, k: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), k);

  test("a wiped course comes back whole; other courses and the user's own task are left alone", async ({ page }) => {
    await emptied(page);
    await run27(page);
    const asg = await rd(page, "hwai_assignments_v1") as Rec[];
    for (const a of ux.assignments as Rec[]) expect(asg.find((x) => x.id === a.id), a.id).toEqual(a);
    expect(asg.some((a) => a.id === "a-my-uxui")).toBe(true);
    expect(asg.some((a) => a.id === "a-elsewhere")).toBe(true);
    expect(await rd(page, "hwai_submissions_v1") as Rec[]).toHaveLength((ux.submissions as Rec[]).length + 1);
    expect(await rd(page, "hwai_rubrics_v1") as Rec[]).toHaveLength((ux.rubrics as Rec[]).length);
    expect(await rd(page, "hwai_student_groups_v1") as Rec[]).toHaveLength((ux.groups as Rec[]).length);
    expect(await rd(page, "hwai_clos_v1") as Rec[]).toHaveLength((ux.clos as Rec[]).length);
    expect(await rd(page, "hwai_grading_categories_v1") as Rec[]).toHaveLength((ux.gradingCategories as Rec[]).length);
    expect(await rd(page, "hwai_students_v1") as Rec[]).toHaveLength((ux.courseStudents as Rec[]).length);          // the roster was empty, so it is filled
  });

  test("running it again changes nothing, and an existing roster is not touched", async ({ page }) => {
    await emptied(page);
    await run27(page);
    const once = [await rd(page, "hwai_assignments_v1"), await rd(page, "hwai_submissions_v1"), await rd(page, "hwai_students_v1")];
    await run27(page);
    expect([await rd(page, "hwai_assignments_v1"), await rd(page, "hwai_submissions_v1"), await rd(page, "hwai_students_v1")]).toEqual(once);
  });

  test("with the real students loaded ([24]) the restored data carries their names", async ({ page }) => {
    const sid = (ux.submissions as Rec[])[0].studentId as string;
    const real = { studentId: "66990002", title: "นาย", name: "ทดสอบ สอง", email: "66990002@kmitl.ac.th" };
    await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ json: { version: 1, map: { [sid]: real }, demo: null } }));
    await emptied(page, { demo: "66990002" });
    await run27(page);
    const subs = await rd(page, "hwai_submissions_v1") as (Rec & { studentName: string })[];
    expect(subs.some((s) => s.studentId === sid)).toBe(false);
    expect(subs.filter((s) => s.studentId === "66990002").every((s) => s.studentName === "ทดสอบ สอง")).toBe(true);
    expect((await rd(page, "hwai_students_v1") as Rec[]).some((s) => s.studentId === "66990002")).toBe(true);
    const groups = await rd(page, "hwai_student_groups_v1") as { memberStudentIds: string[] }[];
    expect(groups.some((g) => g.memberStudentIds.includes("66990002"))).toBe(sid && (ux.groups as { memberStudentIds: string[] }[]).some((g) => g.memberStudentIds.includes(sid)));
  });

  test("without the course in the system it says so", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => localStorage.setItem("hwai_courses_v2", "[]"));
    const said: string[] = [];
    page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
    await page.evaluate(`(${cmd27})`);
    expect(said.join()).toContain("ไม่มีรายวิชา UX/UI");
  });
});

// ── console command [28]: bring the student lists back after they were reset ────────────────────────────────────────────────────────────────
test.describe("console command [28]", () => {
  const cmd28 = (() => {
    const i = DOC.findIndex((l) => l.startsWith("[28]"));
    const line = DOC.find((l, k) => k > i && l.startsWith("(async()=>{const L="));
    if (i < 0 || !line) throw new Error("command [28] not found");
    return line.replace(/;\s*$/, "");
  })();
  const run28 = async (page: Page) => { const reloaded = page.waitForEvent("load"); await page.evaluate(`(${cmd28})`); await reloaded; };
  const hist = mock("student-history-mockup.json");
  const people = mock("students-mockup.json") as (Rec & { program?: string })[];
  const rosterOf = (courses: string[]) => [...flow.courseStudents, ...hist.courseStudents, ...ux.courseStudents].filter((s: Rec & { courseId: string }) => courses.includes(s.courseId)) as Rec[];
  const rd = (page: Page, k: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), k);

  async function wiped(page: Page, courses: string[], demo?: string) {
    await page.goto(`${BASE}/login`);
    await page.evaluate(({ courses, demo }) => {
      localStorage.setItem("hwai_courses_v2", JSON.stringify(courses.map((id) => ({ id, name: id }))));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify([{ id: "cs-mine", studentId: "99000001", name: "ของ ฉัน", email: "99000001@kmitl.ac.th", program: "CE", status: "active" }]));
      localStorage.setItem("hwai_students_v1", JSON.stringify([{ id: "r-mine", courseId: "c-mock-1", studentId: "99000001", name: "ของ ฉัน", email: "99000001@kmitl.ac.th", sequenceNumber: 99, enrollmentStatus: "enrolled" }]));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify([{ id: "a-keep", courseId: "c-mock-1", name: "Stays" }]));
      if (demo) localStorage.setItem("hwai_demo_student", JSON.stringify({ studentId: demo }));
    }, { courses, demo });
  }

  test("the 85 students and the rosters of the courses that exist come back; the user's own rows and everything else stay", async ({ page }) => {
    await wiped(page, ["c-mock-1", "c-mock-4"]);
    await run28(page);
    const cohort = await rd(page, "hwai_cohort_students_v1") as Rec[];
    for (const p of people) expect(cohort.find((c) => c.id === p.id), p.id).toEqual(p);
    expect(cohort.some((c) => c.id === "cs-mine")).toBe(true);
    expect(cohort).toHaveLength(people.length + 1);
    const students = await rd(page, "hwai_students_v1") as Rec[];
    const want = rosterOf(["c-mock-1", "c-mock-4"]);
    for (const s of want) expect(students.find((x) => x.id === s.id), s.id).toEqual(s);
    expect(students).toHaveLength(want.length + 1);                                                   // + the user's own row
    expect(students.some((s) => s.courseId !== "c-mock-1" && s.courseId !== "c-mock-4")).toBe(false);   // courses that are not in the system get no roster
    expect((await rd(page, "hwai_assignments_v1") as Rec[]).map((a) => a.id)).toEqual(["a-keep"]);   // nothing else is touched
  });

  test("running it twice gives the same data", async ({ page }) => {
    await wiped(page, ["c-mock-1", "c-mock-4"]);
    await run28(page);
    const once = [await rd(page, "hwai_cohort_students_v1"), await rd(page, "hwai_students_v1")];
    await run28(page);
    expect([await rd(page, "hwai_cohort_students_v1"), await rd(page, "hwai_students_v1")]).toEqual(once);
  });

  test("with the real students loaded ([24]) the restored lists carry their names and nobody appears twice", async ({ page }) => {
    const ce = people.find((p) => (p.program ?? "CE") === "CE")!;
    const real = { studentId: "66990003", title: "นาย", name: "ทดสอบ สาม", email: "66990003@kmitl.ac.th" };
    await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ json: { version: 1, map: { [ce.studentId as string]: real }, demo: null } }));
    await wiped(page, ["c-mock-1", "c-mock-4"], "66990003");
    await run28(page);
    const cohort = await rd(page, "hwai_cohort_students_v1") as (Rec & { name: string })[];
    expect(cohort.find((c) => c.id === ce.id)).toMatchObject({ studentId: "66990003", name: "ทดสอบ สาม" });
    expect(cohort.some((c) => c.studentId === ce.studentId)).toBe(false);
    expect(new Set(cohort.map((c) => c.studentId)).size).toBe(cohort.length);
    const students = await rd(page, "hwai_students_v1") as Rec[];
    expect(students.some((s) => s.studentId === ce.studentId)).toBe(false);
  });

  test("with no courses in the system it still restores the student list, and the rosters wait for their courses", async ({ page }) => {
    await wiped(page, []);
    await run28(page);
    expect((await rd(page, "hwai_cohort_students_v1") as Rec[]).length).toBe(people.length + 1);
    expect(await rd(page, "hwai_students_v1") as Rec[]).toHaveLength(1);                              // only the user's own row
  });
});

// ── console command [29]: assignments for trying the submit flow in the UX/UI course ───────────────────────────────────────────────────────
import { submissionOpen, isLate, gradingOpen, latePenaltyOf, activeLatePolicy, type Assignment } from "../src/lib/assignments";

test.describe("console command [29]", () => {
  const cmd29 = (() => {
    const i = DOC.findIndex((l) => l.startsWith("[29]"));
    const line = DOC.find((l, k) => k > i && l.startsWith("(()=>{const get="));
    if (i < 0 || !line) throw new Error("command [29] not found");
    return line.replace(/;\s*$/, "");
  })();
  const run29 = async (page: Page) => { const reloaded = page.waitForEvent("load"); await page.evaluate(`(${cmd29})`); await reloaded; };
  const rd = (page: Page, k: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), k);
  const people = mock("students-mockup.json");

  async function loaded(page: Page, o?: { clockOffsetMin?: number; withCourse?: boolean }) {
    await page.goto(`${BASE}/login`);
    await page.evaluate(({ ux, people, off, withCourse }) => {
      localStorage.setItem("hwai_lang", "en");
      localStorage.setItem("hwai_courses_v2", JSON.stringify(withCourse ? [{ id: "c-mock-4", name: "การออกแบบประสบการณ์และส่วนติดต่อผู้ใช้", code: "01076355", sectionNumber: "1", term: 1, academicYear: 2569, status: "active", source: "manual", coverColor: "#0F766E", iconColor: "#0F766E", courseTemplateId: "x", description: "", schedule: "-", room: "-", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] : []));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(ux.assignments));
      localStorage.setItem("hwai_rubrics_v1", JSON.stringify(ux.rubrics));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(ux.submissions));
      localStorage.setItem("hwai_students_v1", JSON.stringify(ux.courseStudents));
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(people));
      localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(ux.gradingCategories));
      localStorage.setItem("hwai_student_groups_v1", JSON.stringify(ux.groups));
      if (off) localStorage.setItem("hwai_clock_offset_min", String(off));
    }, { ux, people, off: o?.clockOffsetMin ?? 0, withCourse: o?.withCourse ?? true });
  }

  test("five test assignments appear with the right states today, none of them in a grading category", async ({ page }) => {
    await loaded(page);
    await run29(page);
    const asg = await rd(page, "hwai_assignments_v1") as Assignment[];
    const t = (n: number) => asg.find((a) => a.id === `a-test-${n}`)!;
    expect(asg.filter((a) => a.id.startsWith("a-test-"))).toHaveLength(5);
    expect(asg.filter((a) => a.id.startsWith("a-test-")).every((a) => a.courseId === "c-mock-4" && a.categoryId === undefined && a.maxPoints === 10)).toBe(true);
    const now = Date.now();
    expect(submissionOpen(t(1), now) && !isLate(t(1), now)).toBe(true);                                      // on time, open
    expect(t(2).submissionType).toBe("group");
    expect(t(2).maxGroupSize).toBe(5);
    expect(submissionOpen(t(3), now) && isLate(t(3), now)).toBe(true);                                       // past due, still accepted
    expect(activeLatePolicy(t(3))).toBeTruthy();
    expect(latePenaltyOf(t(3), { submittedAt: new Date(now).toISOString() })).toBe(1);                      // a day late costs 10% of 10
    expect(submissionOpen(t(4), now)).toBe(false);                                                           // closed
    expect(gradingOpen(t(4), now)).toBe(true);                                                               // and the teacher can grade at once
    expect(t(5).acceptsFiles).toBe(false);
    expect(t(5).rubricIds).toEqual([]);
    const rubrics = await rd(page, "hwai_rubrics_v1") as { id: string; assignmentId: string; criteria: { id: string; maxPoints: number }[] }[];
    for (const n of [1, 2, 3, 4]) {
      const r = rubrics.find((x) => x.assignmentId === `a-test-${n}`)!;
      expect(t(n).rubricIds).toEqual([r.id]);
      expect(r.criteria.reduce((s, c) => s + c.maxPoints, 0)).toBe(10);
      expect(r.criteria.every((c) => c.id.startsWith(`rc-a-test-${n}-`))).toBe(true);
    }
    // the rest of the course is untouched
    for (const a of ux.assignments as Assignment[]) expect(asg.find((x) => x.id === a.id), a.id).toEqual(a);
  });

  test("running it again resets the test set: their hand-ins and teams go, everything else stays", async ({ page }) => {
    await loaded(page);
    await run29(page);
    await page.evaluate(() => {
      const subs = JSON.parse(localStorage.getItem("hwai_submissions_v1") ?? "[]");
      subs.push({ id: "s-t1", assignmentId: "a-test-1", studentId: "69070101", studentName: "x", email: "x", submittedAt: new Date().toISOString(), status: "not_graded" });
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
      localStorage.setItem("hwai_student_groups_v1", JSON.stringify([...JSON.parse(localStorage.getItem("hwai_student_groups_v1") ?? "[]"), { id: "g-t2", assignmentId: "a-test-2", courseId: "c-mock-4", name: "x", memberStudentIds: ["69070101"] }]));
    });
    const before = (await rd(page, "hwai_submissions_v1") as { id: string }[]).length;
    await run29(page);
    const subs = await rd(page, "hwai_submissions_v1") as { id: string; assignmentId: string }[];
    expect(subs.some((s) => s.assignmentId === "a-test-1")).toBe(false);
    expect(subs).toHaveLength(before - 1);
    expect((await rd(page, "hwai_student_groups_v1") as { id: string }[]).some((g) => g.id === "g-t2")).toBe(false);
    expect((await rd(page, "hwai_assignments_v1") as { id: string }[]).filter((a) => a.id.startsWith("a-test-"))).toHaveLength(5);   // not duplicated
  });

  test("the dates follow the system clock, so they are still right after [22] moved it", async ({ page }) => {
    await loaded(page, { clockOffsetMin: 3 * 24 * 60 });
    await run29(page);
    const asg = await rd(page, "hwai_assignments_v1") as Assignment[];
    const t1 = asg.find((a) => a.id === "a-test-1")!, t4 = asg.find((a) => a.id === "a-test-4")!;
    const now = Date.now() + 3 * 24 * 3_600_000;
    expect(submissionOpen(t1, now)).toBe(true);
    expect(submissionOpen(t4, now)).toBe(false);
  });

  test("without the UX/UI course it says so", async ({ page }) => {
    await loaded(page, { withCourse: false });
    const said: string[] = [];
    page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
    await page.evaluate(`(${cmd29})`);
    expect(said.join()).toContain("รัน [16]");
  });

  test("the flow works: a student hands in the on-time one, the late one costs a point, and the closed one cannot be handed in", async ({ page }) => {
    await loaded(page);
    await run29(page);
    await page.evaluate(() => localStorage.setItem("hwai_user", JSON.stringify({ name: "สมชาย ใจดี", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" })));
    await page.goto(`${BASE}/student/courses/c-mock-4/classwork/a-test-1`);
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="url"]').fill("https://www.figma.com/design/test");
    await page.getByRole("button", { name: /^Submit/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^Confirm/ }).click();
    await expect.poll(async () => (await rd(page, "hwai_submissions_v1") as { assignmentId: string }[]).filter((s) => s.assignmentId === "a-test-1").length).toBe(1);
    expect((await rd(page, "hwai_submissions_v1") as { assignmentId: string; late?: boolean }[]).find((s) => s.assignmentId === "a-test-1")!.late).toBeFalsy();

    await page.goto(`${BASE}/student/courses/c-mock-4/classwork/a-test-3`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("late-cost")).toContainText("costs 1 point");

    await page.goto(`${BASE}/student/courses/c-mock-4/classwork/a-test-4`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("submission-closed")).toBeVisible();
  });
});
