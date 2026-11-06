// Gives every CE student of the mock their own real identity (21/10/2569) — LOCAL ONLY, nothing real is ever committed.
//
// The repo is public, so the real names and ids never go into a committed file. This script reads the registrar's roster from a CSV that is
// git-ignored (`local-data/real-roster.csv`, see build-local-class.ts for how to make it) and writes `public/local-data/real-identities.json`,
// also git-ignored: one real identity per mock CE student. Console command [24] in test-data/seed-commands.txt applies it to the browser.
//
//   node scripts/build-local-identities.ts [roster.csv]        (Node 22.18+ / 24 runs TypeScript directly)
//
// Rules (the user's answers of 21/10/2569):
//   - Only CE students are replaced. The CECS and CEI students stay as they are — the roster does not say who belongs to which programme,
//     and the user said every real student is a CE student.
//   - The real id is used as it is, so a student's batch (รุ่น) is the real one: 66 or 67. The mock's batches 68 and 69 are gone from the
//     replaced students (the user chose this over keeping mock ids).
//   - A student cannot have a course from before the year the real id says they were admitted (2500 + the first two digits). So the mock
//     students whose earliest course is the most recent get the batch-67 ids first, and nobody is ever given an id admitted after their
//     first course. Everything is deterministic: the same files give the same pack.
//   - Names and ids move together: the pack maps mock student id → { id, title, first, last, email }; marks, teams and rosters follow the
//     mock id, so nothing else has to be invented.

import fs from "node:fs";
import { parseRoster, type RealStudent } from "./build-local-class.ts";

export interface Identity { studentId: string; title: string; firstName: string; lastName: string; email: string }
export interface MockPerson { studentId: string; program?: string }
export interface Pack { version: 1; code: string; map: Record<string, Identity>; demo: { from: string; to: Identity } | null }

/** Buddhist year of admission, read from the id: 66010123 → 2566. */
export const admissionYear = (studentId: string) => 2500 + Number(studentId.slice(0, 2));

/**
 * One distinct real student per mock CE student. `earliestYear` is the academic year of the first course the mock student is enrolled in
 * (missing = this year's). Throws when the roster is too small or someone has no admissible id.
 */
export function buildIdentityMap(real: RealStudent[], mock: MockPerson[], earliestYear: Map<string, number>, thisYear = 2569): Record<string, Identity> {
  const ce = mock.filter((m) => (m.program ?? "CE") === "CE");
  if (real.length < ce.length) throw new Error(`the roster has ${real.length} students but the mock has ${ce.length} CE students`);
  const yearOf = (id: string) => earliestYear.get(id) ?? thisYear;
  // the freshest first (they can take any batch), the oldest last (they can only take the oldest batches); ties by id so it is deterministic
  const order = [...ce].sort((a, b) => yearOf(b.studentId) - yearOf(a.studentId) || a.studentId.localeCompare(b.studentId));
  // newest batch first, so the batch-67 ids are used up by the students who can have them
  const pool = [...real].sort((a, b) => b.studentId.localeCompare(a.studentId));
  const map: Record<string, Identity> = {};
  for (const m of order) {
    const i = pool.findIndex((r) => admissionYear(r.studentId) <= yearOf(m.studentId));
    if (i < 0) throw new Error(`no real student was admitted early enough for ${m.studentId} (first course in ${yearOf(m.studentId)})`);
    const [r] = pool.splice(i, 1);
    map[m.studentId] = { studentId: r.studentId, title: r.title, firstName: r.firstName, lastName: r.lastName, email: `${r.studentId}@kmitl.ac.th` };
  }
  return map;
}

/** Problems with a map, empty when it is sound — used by the test and printed by the command line. */
export function checkIdentityMap(map: Record<string, Identity>, mock: MockPerson[], earliestYear: Map<string, number>, thisYear = 2569): string[] {
  const problems: string[] = [];
  const ids = Object.values(map).map((x) => x.studentId);
  if (new Set(ids).size !== ids.length) problems.push("two mock students share a real id");
  for (const m of mock) {
    const to = map[m.studentId];
    const isCe = (m.program ?? "CE") === "CE";
    if (isCe && !to) problems.push(`${m.studentId} (CE) has no real identity`);
    if (!isCe && to) problems.push(`${m.studentId} (${m.program}) must keep its mock identity`);
    if (to && admissionYear(to.studentId) > (earliestYear.get(m.studentId) ?? thisYear)) problems.push(`${m.studentId} gets an id admitted after their first course`);
  }
  return problems;
}

// ── command line ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const isMain = (process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/build-local-identities.ts");
if (isMain) {
  const csvPath = process.argv[2] ?? "local-data/real-roster.csv";
  if (!fs.existsSync(csvPath)) throw new Error(`no roster at ${csvPath} — see the header of scripts/build-local-class.ts`);
  const read = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));
  const people = read("students-mockup.json") as MockPerson[];
  const courses = read("courses-mockup.json") as { id: string; academicYear: number }[];
  const yearOfCourse = new Map(courses.map((c) => [c.id, c.academicYear]));
  const earliest = new Map<string, number>();
  for (const f of ["student-flow-mockup.json", "student-history-mockup.json", "student-uxui-mockup.json"]) {
    for (const s of (read(f).courseStudents ?? []) as { courseId: string; studentId: string }[]) {
      const y = yearOfCourse.get(s.courseId);
      if (y !== undefined) earliest.set(s.studentId, Math.min(earliest.get(s.studentId) ?? y, y));
    }
  }
  const roster = parseRoster(fs.readFileSync(csvPath, "utf8"));
  const map = buildIdentityMap(roster.students, people, earliest);
  const problems = checkIdentityMap(map, people, earliest);
  if (problems.length) throw new Error(problems.join("\n"));
  const demoFrom = "69070101";
  const pack: Pack = { version: 1, code: roster.code, map, demo: map[demoFrom] ? { from: demoFrom, to: map[demoFrom] } : null };
  fs.mkdirSync("public/local-data", { recursive: true });
  fs.writeFileSync("public/local-data/real-identities.json", JSON.stringify(pack));
  const batches = new Map<string, number>();
  for (const x of Object.values(map)) batches.set(x.studentId.slice(0, 2), (batches.get(x.studentId.slice(0, 2)) ?? 0) + 1);
  console.log(`public/local-data/real-identities.json: ${Object.keys(map).length} CE students replaced (${[...batches].map(([b, n]) => `batch ${b}: ${n}`).join(", ")}); ${people.length - Object.keys(map).length} CECS/CEI students unchanged; demo student ${demoFrom} -> ${map[demoFrom]?.studentId ?? "(unchanged)"}`);
}
