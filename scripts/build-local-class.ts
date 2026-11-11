// Builds a LOCAL-ONLY copy of the c-mock-1 class from a real exam-score sheet (15/10/2569).
//
// The repo is public, so real students' names and ids never go into a committed file: this script reads the roster from a CSV that is
// git-ignored (`local-data/real-roster.csv`) and writes `public/local-data/real-class.json`, also git-ignored. Console command [23] in
// test-data/seed-commands.txt loads it into the browser. The script itself holds no real data.
//
//   1. Save the registrar's .xls as CSV (UTF-8) into local-data/real-roster.csv
//        (Excel: File > Save As > "CSV UTF-8";  or in PowerShell:  $wb.Worksheets.Item(1).SaveAs($path, 62) )
//   2. node scripts/build-local-class.ts            (Node 22.18+ / 24 runs TypeScript directly)
//   3. run console command [23] in the browser
//
// Marks and submissions are NOT invented: every real student borrows the (already realistic) marks of one student of the committed
// c-mock-1 class, so every invariant of that mock (criterion points add up, statuses, announced exam, …) carries over. The demo student
// (69070101 — the identity the multi-role teacher account and the Dev Bypass "Student" button act as) hands his marks to one real student.

import fs from "node:fs";

export interface RealStudent { studentId: string; title: string; name: string; group: number }
export interface Roster { code: string; students: RealStudent[] }

interface FlowStudent { id: string; courseId: string; studentId: string; name: string; email: string; enrollmentStatus: string }
interface FlowSubmission { id: string; assignmentId: string; studentId: string; studentName: string; email: string; [k: string]: unknown }
export interface Flow { courseStudents: FlowStudent[]; submissions: FlowSubmission[]; assignments: { id: string }[] }

const TITLES = ["นางสาว", "นาย", "นาง", "เด็กชาย", "เด็กหญิง"];

/** The registrar's exam sheet: header lines per page, then rows `no, student id, "<title><first>  <last>", …`; "กลุ่ม N" says which section follows. */
export function parseRoster(csv: string): Roster {
  const rows = csv.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.split(","));
  let group = 1;
  let code = "";
  const students: RealStudent[] = [];
  for (const r of rows) {
    const line = r.join(",");
    const g = line.match(/กลุ่ม\s*(\d+)/);
    if (g) group = Number(g[1]);
    const c = line.match(/รหัสวิชา\s*(\d{8})/);
    if (c && !code) code = c[1];
    if (!/^\s*\d+\s*$/.test(r[0] ?? "") || !/^\d{8}$/.test((r[1] ?? "").trim())) continue;
    const full = (r[2] ?? "").trim();
    const title = TITLES.find((t) => full.startsWith(t)) ?? "";
    const rest = full.slice(title.length).trim();
    students.push({ studentId: r[1].trim(), title, name: rest.split(/\s+/).join(" "), group });
  }
  return { code, students };
}

/** A small deterministic generator, so the same sheet always gives the same class. */
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface BuildOptions {
  /** the mock's demo student, whose data moves to `demoTo` */
  demoFrom?: string;
  /** the real student who becomes the demo student */
  demoTo: string;
  /** section 1 of the subject (the full class) and section 2 (the sheet's second group) */
  primaryCourseId?: string;
  secondCourseId?: string;
  seed?: number;
}

export function buildClass(roster: Roster, flow: Flow, o: BuildOptions) {
  const demoFrom = o.demoFrom ?? "69070101";
  const primary = o.primaryCourseId ?? "c-mock-1";
  const second = o.secondCourseId ?? "c-mock-7";
  const rnd = mulberry32(o.seed ?? 20261015);

  const sectionOne = roster.students.filter((s) => s.group === 1);
  const others = roster.students.filter((s) => s.group !== 1);
  if (!roster.students.some((s) => s.studentId === o.demoTo)) throw new Error(`demo student ${o.demoTo} is not in the roster`);
  if (!sectionOne.some((s) => s.studentId === o.demoTo)) throw new Error(`demo student ${o.demoTo} must be in section 1`);

  // who lends marks to whom: the demo student's own marks go to demoTo, the rest of the class's marks are spread evenly over everyone else
  const lenders = flow.courseStudents.filter((s) => s.courseId === primary && s.studentId !== demoFrom).map((s) => s.studentId);
  const order = sectionOne.filter((s) => s.studentId !== o.demoTo).map((s) => s.studentId);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const lender = new Map<string, string>([[o.demoTo, demoFrom]]);
  order.forEach((id, i) => lender.set(id, lenders[i % lenders.length]));

  const email = (id: string) => `${id}@kmitl.ac.th`;
  const nameOf = (s: RealStudent) => s.name;
  const cohortStudents = roster.students.map((s) => ({ id: `cs-real-${s.studentId}`, studentId: s.studentId, title: s.title, name: s.name, email: email(s.studentId), program: "CE", status: "active" }));
  const roll = (list: RealStudent[], courseId: string) => list.map((s) => ({ id: `s-real-${courseId}-${s.studentId}`, courseId, studentId: s.studentId, name: s.name, email: email(s.studentId), enrollmentStatus: "enrolled" }));
  const courseStudents = [...roll(sectionOne, primary), ...roll(others, second)];

  const byStudent = new Map<string, FlowSubmission[]>();
  for (const sub of flow.submissions) byStudent.set(sub.studentId, [...(byStudent.get(sub.studentId) ?? []), sub]);
  const submissions: FlowSubmission[] = [];
  for (const s of sectionOne) {
    for (const sub of byStudent.get(lender.get(s.studentId)!) ?? []) {
      submissions.push({ ...sub, id: `sub-real-${sub.assignmentId}-${s.studentId}`, studentId: s.studentId, studentName: nameOf(s), email: email(s.studentId) });
    }
  }

  const demo = roster.students.find((s) => s.studentId === o.demoTo)!;
  return {
    code: roster.code,
    cohortStudents,
    courseStudents,
    assignmentIds: flow.assignments.map((a) => a.id),
    submissions,
    demo: { from: demoFrom, studentId: o.demoTo, name: nameOf(demo), title: demo.title, email: email(o.demoTo) },
    courses: { primary, second },
  };
}

// ── command line ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isMain = (process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/build-local-class.ts");
if (isMain) {
  const csvPath = process.argv[2] ?? "local-data/real-roster.csv";
  const demoTo = process.argv[3] ?? process.env.DEMO_STUDENT ?? "";
  if (!fs.existsSync(csvPath)) throw new Error(`no roster at ${csvPath} — see the header of this script`);
  if (!demoTo) throw new Error("say which student becomes the demo student: node scripts/build-local-class.ts <csv> <studentId>");
  const flow = JSON.parse(fs.readFileSync("public/mock-data/student-flow-mockup.json", "utf8")) as Flow;
  const out = buildClass(parseRoster(fs.readFileSync(csvPath, "utf8")), flow, { demoTo });
  fs.mkdirSync("public/local-data", { recursive: true });
  fs.writeFileSync("public/local-data/real-class.json", JSON.stringify(out));
  const n = (c: string) => out.courseStudents.filter((s) => s.courseId === c).length;
  console.log(`public/local-data/real-class.json: ${out.cohortStudents.length} students (${out.courses.primary}: ${n(out.courses.primary)}, ${out.courses.second}: ${n(out.courses.second)}), ${out.submissions.length} submissions`);
}
