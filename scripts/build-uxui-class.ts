// Rebuilds the UX/UI class of the mock (c-mock-4 sec 1, 2569/1) — 15/10/2569.
//
//   node scripts/build-uxui-class.ts        (Node 22.18+ / 24 runs TypeScript directly)
//
// What it writes (public/mock-data and test-data, th and en — the same content in both: the user asked for Thai rubrics):
// student-uxui-mockup.json / -en.json with the course's 30 students (kept from the existing file), 3 grading categories (no exams in this course),
// the 20 assignments of the Classroom screenshot + the Final project, a rubric for each, the course's five CLOs, six teams for the group work, and
// what the students handed in with realistic marks. Console command [16] loads it.
//
// Everything is deterministic (seeded). The assignments, points, rubrics and descriptions are in scripts/uxui-assignments.ts; the marks are not
// invented one by one: each student has an ability, each criterion's level follows it with some noise, a team has the ability of its members.

import fs from "node:fs";
import { ASSIGNMENTS, FINAL, CLOS, LEVEL_LABELS, type AsgSpec, type CritSpec } from "./uxui-assignments.ts";

export const COURSE_ID = "c-mock-4";
export const TEAM_SIZE = 5;
const T0 = "2026-08-12T09:00:00.000Z";

interface Student { id: string; courseId: string; studentId: string; name: string; email: string; sequenceNumber: number; enrollmentStatus: string }
export interface ExistingClass { courseStudents: Student[]; submissions: { assignmentId: string; studentId: string }[] }

// ── seeded randomness ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const randn = (rnd: () => number) => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const shuffle = <T,>(xs: T[], rnd: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── marks ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What a level is worth: the rubric's four levels are 100 / 66.67 / 33.33 / 0 % of the criterion, rounded (lib/assignments.ts levelPointsOf). */
export const levelPoints = (max: number, li: number, n = 4) => Math.round(max * (n - 1 - li) / (n - 1));
const levelFromShare = (s: number): number => (s >= 0.83 ? 0 : s >= 0.5 ? 1 : s >= 0.17 ? 2 : 3);

/** Level index (0 = best) per criterion for someone of ability `z`. Nobody gets full marks on an assignment worth 10 points or more. */
function levelsFor(rnd: () => number, z: number, spec: AsgSpec): number[] {
  const lv: number[] = spec.criteria.map(() => levelFromShare(clamp(0.7 + 0.13 * z + 0.1 * randn(rnd), 0, 1)));
  if (spec.points >= 10 && Math.max(...lv) === 0) lv[lv.length - 1] = 1;
  return lv;
}
/** The AI's version of the same marks: usually the same level, sometimes one off (a little kinder than the teacher, or stricter). */
const aiLevels = (rnd: () => number, lv: number[]) => lv.map((l) => { const r = rnd(); return clamp(l + (r < 0.2 ? -1 : r < 0.35 ? 1 : 0), 0, 3); });

const COMMENTS = [
  "ทำได้ดี เหตุผลชัดเจน", "ลองเพิ่มหลักฐานหรือภาพประกอบอีกนิด", "แนวคิดดี แต่ยังขาดการเชื่อมโยงกับข้อมูลผู้ใช้",
  "จัดวางเป็นระเบียบ ปรับระยะห่างอีกเล็กน้อยจะดีขึ้น", "ส่งตรงเวลาและครบถ้วน", "ควรอธิบายเหตุผลของการตัดสินใจให้มากขึ้น",
  "ผลงานประณีต ใช้ Component ได้สม่ำเสมอ", "ลองทดสอบกับผู้ใช้เพิ่มอีกสักคนแล้วสรุปให้ชัดขึ้น",
];

const id22 = (rnd: () => number) => Array.from({ length: 22 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(rnd() * 62)]).join("");

// ── the build ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const cloId = (n: number) => `clo-uxui-${n}`;
const rubricId = (a: AsgSpec) => (a.id === FINAL.id ? "r-mock-10" : `r-${a.id.replace("a-", "")}`);
const critId = (a: AsgSpec, k: number) => (a.id === FINAL.id ? `rc-uxui-${k + 1}` : `rc-${a.id.replace("a-", "")}-${k + 1}`);
const categoryOf = (a: AsgSpec) => (a.id === FINAL.id ? "gcat-uxui-final" : a.type === "individual" ? "gcat-uxui-ind" : "gcat-uxui-grp");

export function buildUxuiClass(existing: ExistingClass) {
  const students = existing.courseStudents;
  const finalSubmitters = new Set(existing.submissions.filter((s) => s.assignmentId === FINAL.id).map((s) => s.studentId));
  if (finalSubmitters.size === 0) throw new Error("the existing file has no Final project submissions to take the submitters from");
  const byId = new Map(students.map((s) => [s.studentId, s]));
  const ability = new Map(students.map((s) => [s.studentId, randn(mulberry32(hash("ability:" + s.studentId)))]));
  ability.set("69070101", 0.8);   // the main demo login does well, as before (87/100 on the Final project)
  const nameOf = (id: string) => { const s = byId.get(id)!; return s.name; };

  // teams: the same six for the group work, re-mixed for the two ideation workshops
  const mix = (seed: number) => {
    const order = shuffle(students.map((s) => s.studentId), mulberry32(seed));
    return Array.from({ length: Math.ceil(order.length / TEAM_SIZE) }, (_, t) => order.slice(t * TEAM_SIZE, (t + 1) * TEAM_SIZE));
  };
  const TEAMS = mix(20261015);
  const TEAM_NAMES = ["ทีมดอกไม้ไฟ", "ทีมกาแฟเย็น", "ทีมใบเตย", "ทีมหิ่งห้อย", "ทีมเมฆฝน", "ทีมลูกเกด"];
  const REMIX = new Set(["a-uxui-8", "a-uxui-9"]);
  const REMIXED = mix(20261016);
  const MIX_NAMES = ["กลุ่ม A", "กลุ่ม B", "กลุ่ม C", "กลุ่ม D", "กลุ่ม E", "กลุ่ม F"];
  const LATE: Record<string, number[]> = { "a-uxui-20": [1, 4], "a-uxui-12": [2] };   // team indexes that hand in just after the deadline

  const all = [...ASSIGNMENTS, FINAL];
  const gradingCategories = [
    { id: "gcat-uxui-ind", courseId: COURSE_ID, name: "งานเดี่ยว", weight: 20, createdAt: T0, updatedAt: T0 },
    { id: "gcat-uxui-grp", courseId: COURSE_ID, name: "งานกลุ่ม", weight: 30, createdAt: T0, updatedAt: T0 },
    { id: "gcat-uxui-final", courseId: COURSE_ID, name: "โปรเจกต์ปลายภาค", weight: 50, createdAt: T0, updatedAt: T0 },
  ];

  const assignments = all.map((a) => ({
    id: a.id, courseId: COURSE_ID, name: a.name, description: a.description, dueDate: a.due, maxPoints: a.points, categoryId: categoryOf(a),
    acceptsFiles: true, fileTypes: a.files, submissionType: a.type, maxGroupSize: a.type === "group" ? TEAM_SIZE : null, rubricIds: [rubricId(a)],
    ...(a.announced ? { gradingFinalized: true } : {}), createdAt: T0, updatedAt: a.announced ? `${a.due}T17:00:00.000Z` : T0,
  }));

  const rubrics = all.map((a) => {
    const total = a.criteria.reduce((n, c) => n + c.points, 0);
    return {
      id: rubricId(a), assignmentId: a.id, name: a.id === FINAL.id ? "เกณฑ์ตรวจโปรเจกต์ UX/UI ปลายภาค" : `เกณฑ์ตรวจ ${a.name}`,
      criteria: a.criteria.map((c: CritSpec, k) => ({
        id: critId(a, k), name: c.name, description: c.description, maxPoints: c.points, weight: Math.round((c.points / total) * 100),
        levels: c.levels.map((d, li) => ({ label: LEVEL_LABELS[li], description: d })), cloIds: c.clo.map(cloId),
      })),
      createdAt: T0, updatedAt: T0,
    };
  });

  const clos = CLOS.map((text, i) => ({ id: cloId(i + 1), courseId: COURSE_ID, code: `CLO${i + 1}`, text, createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z" }));

  const groups: unknown[] = [];
  const submissions: Record<string, unknown>[] = [];
  const mkRow = (a: AsgSpec, studentId: string, o: { id: string; submittedAt: string; status: "graded" | "need_review" | "not_graded"; lv: number[]; ai: number[]; groupId?: string; late?: boolean; link?: string; comment?: string }) => {
    const pts = (levels: number[]) => Object.fromEntries(a.criteria.map((c, k) => [critId(a, k), levelPoints(c.points, levels[k])]));
    const sum = (levels: number[]) => a.criteria.reduce((n, c, k) => n + levelPoints(c.points, levels[k]), 0);
    const graded = o.status === "graded", reviewed = o.status !== "not_graded";
    return {
      id: o.id, assignmentId: a.id, studentId, studentName: nameOf(studentId), email: byId.get(studentId)!.email, submittedAt: o.submittedAt,
      ...(o.link ? { attachments: [{ id: `att-${o.id}`, kind: "link", name: "Figma", source: "url", ref: o.link }] } : {}),
      aiScore: reviewed ? sum(o.ai) : null, instructorScore: graded ? sum(o.lv) : null, instructorComment: o.comment ?? "", externalUseConsent: true,
      status: o.status, updatedAt: new Date(Date.parse(o.submittedAt) + (1 + Math.floor(hash(o.id) % 3)) * 86_400_000).toISOString(),
      ...(graded ? { criterionScores: pts(o.lv) } : {}),
      ...(reviewed ? { aiCriterionScores: pts(o.ai) } : {}),
      ...(o.groupId ? { groupId: o.groupId } : {}),
      ...(o.late ? { late: true } : {}),
    };
  };

  for (const a of all) {
    const rnd = mulberry32(hash("work:" + a.id));
    const dueMs = Date.parse(`${a.due}T23:59:59+07:00`);
    const onTime = () => new Date(Math.round((dueMs - (2 + rnd() * 80) * 3_600_000) / 60_000) * 60_000).toISOString();
    const late = () => new Date(Math.round((dueMs + (5 + rnd() * 50) * 60_000) / 60_000) * 60_000).toISOString();
    const slug = a.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "UXUI";
    const link = () => (a.figmaLink ? `https://www.figma.com/design/${id22(rnd)}/UXUI-${slug}` : undefined);
    const comment = () => (rnd() < 0.18 ? COMMENTS[Math.floor(rnd() * COMMENTS.length)] : "");

    if (a.type === "individual") {
      const order = shuffle(students.map((s) => s.studentId), mulberry32(hash("order:" + a.id)));
      const queue = new Map(order.map((id, i) => [id, i]));
      for (const s of students) {
        const z = ability.get(s.studentId)!;
        const missing = a.id === FINAL.id ? !finalSubmitters.has(s.studentId) : rnd() < 0.03 + (z < -0.5 ? 0.05 : 0);
        if (missing) continue;
        const lv = levelsFor(rnd, z, a);
        // Usability Testing (not announced): some work still waits for the teacher
        const q = queue.get(s.studentId)!;
        const status = a.id === "a-uxui-18" ? (q < 5 ? "need_review" : q < 9 ? "not_graded" : "graded") : "graded";
        submissions.push(mkRow(a, s.studentId, { id: a.id === FINAL.id ? `sub-uxui-${s.studentId}` : `sub-${a.id}-${s.studentId}`, submittedAt: onTime(), status, lv, ai: aiLevels(rnd, lv), link: link(), comment: comment() }));
      }
    } else {
      const teams = REMIX.has(a.id) ? REMIXED : TEAMS;
      const names = REMIX.has(a.id) ? MIX_NAMES : TEAM_NAMES;
      teams.forEach((members, t) => {
        const gid = `grp-${a.id}-${t + 1}`;
        groups.push({ id: gid, assignmentId: a.id, courseId: COURSE_ID, name: names[t], memberStudentIds: members, createdAt: T0, updatedAt: T0 });
        const z = members.reduce((n, id) => n + ability.get(id)!, 0) / members.length + 0.1 * randn(rnd);
        const lv = levelsFor(rnd, z, a);
        const ai = aiLevels(rnd, lv);
        const submittedAt = (LATE[a.id] ?? []).includes(t) ? late() : onTime();
        const isLate = (LATE[a.id] ?? []).includes(t);
        const lnk = link();
        const status = a.id === "a-uxui-17" ? (t === 4 ? "need_review" : t === 5 ? "not_graded" : "graded") : "graded";
        const cmt = comment();
        for (const studentId of members) submissions.push(mkRow(a, studentId, { id: `sub-${a.id}-${studentId}`, submittedAt, status, lv, ai, groupId: gid, late: isLate, link: lnk, comment: cmt }));
      });
    }
  }

  return { courseStudents: students, gradingCategories, assignments, rubrics, submissions, groups, clos };
}

// ── command line ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isMain = (process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/build-uxui-class.ts");
if (isMain) {
  const existing = JSON.parse(fs.readFileSync("public/mock-data/student-uxui-mockup.json", "utf8")) as ExistingClass;
  const out = buildUxuiClass(existing);
  for (const dir of ["public/mock-data", "test-data"]) for (const f of ["student-uxui-mockup.json", "student-uxui-mockup-en.json"]) fs.writeFileSync(`${dir}/${f}`, JSON.stringify(out, null, 2) + "\n");
  console.log(`${out.assignments.length} assignments, ${out.rubrics.length} rubrics, ${out.groups.length} teams, ${out.submissions.length} submissions, ${out.clos.length} CLOs`);
}
