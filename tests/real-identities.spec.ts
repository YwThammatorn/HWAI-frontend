import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execSync } from "node:child_process";

import { buildIdentityMap, checkIdentityMap, admissionYear, type MockPerson } from "../scripts/build-local-identities";
import { parseRoster, type RealStudent } from "../scripts/build-local-class";

// 21/10/2569 — every CE student of the mock gets a real identity, on this machine only. The tests below use a made-up roster (the real one
// is never committed); they check the rules, and that nothing real has leaked into a file that is committed.

const real = (n: number, batch: number): RealStudent => ({ studentId: `${batch}0101${String(n).padStart(2, "0")}`, title: n % 2 ? "นาย" : "นางสาว", firstName: `ชื่อ${batch}${n}`, lastName: `สกุล${n}`, group: 1 });
const ROSTER: RealStudent[] = [...Array.from({ length: 12 }, (_, i) => real(i + 1, 66)), ...Array.from({ length: 5 }, (_, i) => real(i + 20, 67))];

const MOCK: MockPerson[] = [
  { studentId: "66000001", program: "CE" }, { studentId: "67000002", program: "CE" }, { studentId: "68000003", program: "CE" },
  { studentId: "69000004", program: "CE" }, { studentId: "69000005", program: "CE" }, { studentId: "69000006", program: "CE" },
  { studentId: "69000007", program: "CECS" }, { studentId: "69000008", program: "CEI" },
];
// the first academic year each mock student is enrolled in: the 66 student has courses back to 2566, the rest are newer
const EARLIEST = new Map<string, number>([["66000001", 2566], ["67000002", 2567], ["68000003", 2568], ["69000004", 2569], ["69000005", 2569]]);

test.describe("who gets which real identity", () => {
  const map = buildIdentityMap(ROSTER, MOCK, EARLIEST);

  test("every CE student gets a different real student; CECS and CEI students keep theirs", () => {
    expect(Object.keys(map).sort()).toEqual(["66000001", "67000002", "68000003", "69000004", "69000005", "69000006"]);
    expect(new Set(Object.values(map).map((x) => x.studentId)).size).toBe(6);
    expect(map["69000007"]).toBeUndefined();
    expect(map["69000008"]).toBeUndefined();
    expect(checkIdentityMap(map, MOCK, EARLIEST)).toEqual([]);
  });

  test("a real id is never admitted after the student's first course", () => {
    expect(admissionYear("66010101")).toBe(2566);
    for (const [mockId, to] of Object.entries(map)) expect(admissionYear(to.studentId)).toBeLessThanOrEqual(EARLIEST.get(mockId) ?? 2569);
    expect(admissionYear(map["66000001"].studentId)).toBe(2566);                    // the one with a 2566 course can only be batch 66
  });

  test("the newest batch is handed to the newest students first, so both batches appear", () => {
    const batches = Object.values(map).map((x) => x.studentId.slice(0, 2));
    expect(batches.filter((b) => b === "67").length).toBe(5);                        // all five 67 ids are used up before any extra 66 is needed
    expect(batches.filter((b) => b === "66").length).toBe(1);
  });

  test("the same input always gives the same pack", () => {
    expect(buildIdentityMap(ROSTER, [...MOCK].reverse(), EARLIEST)).toEqual(map);
  });

  test("the email follows the real id, and a roster that is too small is refused", () => {
    expect(Object.values(map).every((x) => x.email === `${x.studentId}@kmitl.ac.th`)).toBe(true);
    expect(() => buildIdentityMap(ROSTER.slice(0, 3), MOCK, EARLIEST)).toThrow(/has 3 students/);
  });

  test("the check catches a broken map", () => {
    const bad = { ...map, "66000001": { ...map["69000004"] } };                       // a duplicate id, and a batch-67 id for a 2566 student
    const problems = checkIdentityMap(bad, MOCK, EARLIEST);
    expect(problems.some((p) => /share a real id/.test(p))).toBe(true);
  });
});

// ── console command [24], run against the whole mock with a made-up pack (ids 6699xxxx / 6799xxxx never exist anywhere) ──────────────────────
const readJson = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
const COMMAND = (() => {
  const line = fs.readFileSync("test-data/seed-commands.txt", "utf8").split(/\r?\n/).find((l) => l.startsWith("fetch('/local-data/real-identities.json')"));
  if (!line) throw new Error("command [24] not found in test-data/seed-commands.txt");
  return line.replace(/;s*$/, "");
})();

test.describe("console command [24]", () => {
  const people = readJson("students-mockup.json") as (MockPerson & { id: string })[];
  const flow = readJson("student-flow-mockup.json"), hist = readJson("student-history-mockup.json"), ux = readJson("student-uxui-mockup.json");
  const courses = readJson("courses-mockup.json") as { id: string; academicYear: number }[];
  const yearOf = new Map(courses.map((c) => [c.id, c.academicYear]));
  const rosterStudents = [...flow.courseStudents, ...hist.courseStudents, ...ux.courseStudents] as { courseId: string; studentId: string }[];
  const earliest = new Map<string, number>();
  for (const s of rosterStudents) { const y = yearOf.get(s.courseId); if (y !== undefined) earliest.set(s.studentId, Math.min(earliest.get(s.studentId) ?? y, y)); }
  const fake: RealStudent[] = Array.from({ length: 80 }, (_, i) => ({ studentId: `${i < 50 ? 66 : 67}99${String(i).padStart(4, "0")}`, title: "นาย", firstName: `ทดสอบ${i}`, lastName: "ปลอม", group: 1 }));
  const map = buildIdentityMap(fake, people, earliest);
  const pack = { version: 1, code: "00000000", map, demo: { from: "69070101", to: map["69070101"] } };
  const nm = (r: { firstName: string; lastName: string }) => `${r.firstName} ${r.lastName}`;

  // the command ends with a reload: wait for it before reading anything
  async function run(page: import("@playwright/test").Page) {
    const reloaded = page.waitForEvent("load");
    await page.evaluate(`(async () => { await (${COMMAND}); })()`);
    await reloaded;
  }
  async function load(page: import("@playwright/test").Page) {
    await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ json: pack }));
    await page.goto("/login");
    await page.evaluate(({ cohort, students, subs, groups }) => {
      localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(cohort));
      localStorage.setItem("hwai_students_v1", JSON.stringify(students));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
      localStorage.setItem("hwai_student_groups_v1", JSON.stringify(groups));
    }, { cohort: people, students: [...flow.courseStudents, ...hist.courseStudents, ...ux.courseStudents], subs: [...flow.submissions, ...hist.submissions, ...ux.submissions], groups: ux.groups ?? [] });
  }
  const read = (page: import("@playwright/test").Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), key);

  test("CE students everywhere take their real identity; CECS and CEI stay; the whole mock still hangs together", async ({ page }) => {
    await load(page);
    await run(page);
    const cohort = await read(page, "hwai_cohort_students_v1") as { studentId: string; program: string; firstName: string; lastName: string; email: string }[];
    const students = await read(page, "hwai_students_v1") as { studentId: string; firstName: string; lastName: string; email: string }[];
    const subs = await read(page, "hwai_submissions_v1") as { studentId: string; studentName: string; email: string }[];
    const groups = await read(page, "hwai_student_groups_v1") as { memberStudentIds: string[] }[];
    // cohort: every CE student is one of the fake real ones, the others are untouched
    for (const p of people) {
      const now = cohort.find((c) => (c as unknown as { id: string }).id === p.id)!;
      if ((p.program ?? "CE") === "CE") expect(now.studentId).toBe(map[p.studentId].studentId);
      else expect(now.studentId).toBe(p.studentId);
    }
    expect(new Set(cohort.map((c) => c.studentId)).size).toBe(people.length);                         // still all different
    expect(cohort.every((c) => c.email === `${c.studentId}@kmitl.ac.th`)).toBe(true);
    // everyone who is on a roster, handed work in or sits in a team is still someone in the cohort, under the same name
    const byId = new Map(cohort.map((c) => [c.studentId, c]));
    for (const s of students) { const c = byId.get(s.studentId); expect(c, `roster student ${s.studentId}`).toBeTruthy(); expect([s.firstName, s.lastName, s.email]).toEqual([c!.firstName, c!.lastName, c!.email]); }
    for (const s of subs) { const c = byId.get(s.studentId); expect(c, `submission of ${s.studentId}`).toBeTruthy(); expect(s.studentName).toBe(nm(c!)); expect(s.email).toBe(c!.email); }
    for (const g of groups) for (const m of g.memberStudentIds) expect(byId.has(m), `team member ${m}`).toBe(true);
    // nothing is lost: the same number of rosters, submissions and teams
    expect(students).toHaveLength(flow.courseStudents.length + hist.courseStudents.length + ux.courseStudents.length);
    expect(subs).toHaveLength(flow.submissions.length + hist.submissions.length + ux.submissions.length);
    // the demo student is the swapped one
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hwai_demo_student") ?? "null"))).toEqual({ studentId: pack.demo.to.studentId, name: nm(pack.demo.to) });
  });

  test("running it twice (or after [23]) stops with a message and changes nothing", async ({ page }) => {
    await load(page);
    await run(page);
    const before = await page.evaluate(() => localStorage.getItem("hwai_cohort_students_v1"));
    const said: string[] = [];
    page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
    await page.evaluate(`(async () => { await (${COMMAND}); })()`);
    expect(said.join()).toContain("ในเบราว์เซอร์มีนักศึกษาจริงอยู่แล้ว");
    expect(await page.evaluate(() => localStorage.getItem("hwai_cohort_students_v1"))).toBe(before);
  });

  test("without the local file the command says so", async ({ page }) => {
    await page.route("**/local-data/real-identities.json", (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto("/login");
    const said: string[] = [];
    page.on("dialog", (d) => { said.push(d.message()); void d.dismiss(); });
    await page.evaluate(`(async () => { await (${COMMAND}); })()`);
    expect(said.join()).toContain("ยังไม่มีไฟล์ข้อมูลในเครื่อง");
  });
});

test("the identity pack stays out of git", () => {
  execSync("git check-ignore -q public/local-data/real-identities.json");
  expect(execSync("git ls-files local-data public/local-data").toString().trim()).toBe("");
});

test.describe("nothing real is committed", () => {
  const ROSTER_FILE = "local-data/real-roster.csv";
  test.skip(!fs.existsSync(ROSTER_FILE), "no local roster on this machine — nothing to compare against");

  test("no real id or name appears in a file the repository tracks", () => {
    const roster = parseRoster(fs.readFileSync(ROSTER_FILE, "utf8"));
    const files = ["test-data", "public/mock-data", "scripts", "tests", "src"].flatMap((dir) => walk(dir)).filter((f) => !f.endsWith("real-identities.spec.ts"));
    const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const leaked = roster.students.filter((s) => text.includes(s.studentId) || (s.firstName.length > 3 && text.includes(`${s.firstName} ${s.lastName}`)));
    expect(leaked.map((s) => s.studentId)).toEqual([]);
  });
});

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? (e.name === "node_modules" || e.name === "local-data" ? [] : walk(p)) : /\.(json|ts|tsx|txt|csv|md)$/.test(e.name) ? [p] : [];
  });
}
