// Rebuilds the mock's teachers from the real teachers of the CE department (15/10/2569).
//
//   node scripts/build-real-teachers.ts      (Node 22.18+ / 24 runs TypeScript directly)
//
// Source of the people: https://www.ce.kmitl.ac.th/FacultyMem — a public department page (the head of department and the อาจารย์; the staff
// listed there are not teachers). Only the name, the academic title and the published @kmitl.ac.th e-mail are kept: no phone numbers, rooms
// or personal e-mail addresses. ONE e-mail is not on the page (อ.จิระศักดิ์ lists only a personal one), so `jirasak.si@kmitl.ac.th` is MADE UP
// in the department's pattern — see `madeUp`.
//
// Who teaches what is NOT on that page. What is known comes from the department's Moodle (https://cms.ce.kmitl.ac.th, linked from the page,
// public front page): Computer Programming → Kiatnarong Tongprasert · Computer Programming (Python) → Kanut Tangtisanon · Data Communication
// and Internetworking Standards → Jirasak Sittigorn · Computer Organization and Assembly Language → Surin Kittitornkun. Everything else below
// is INVENTED (one subject family per teacher, in a fixed order) so that every course of the mock still has exactly one teacher.
//
// Rewrites teachers-mockup.json and teachers-mockup-en.json in public/mock-data and test-data (names are Thai in both: teacher names are
// always Thai, whatever the language). A course has no teacher field — the link is `Teacher.courseIds`. Safe to run again.

import fs from "node:fs";

export interface RealTeacher { key: string; title?: string; name: string; email: string; madeUp?: boolean }

// page order: the head of department first, then the อาจารย์ as listed
export const REAL_TEACHERS: RealTeacher[] = [
  { key: "amnach", title: "ผศ.ดร.", name: "อำนาจ ขาวเน", email: "amnach.kh@kmitl.ac.th" },
  { key: "charoen", title: "รศ.ดร.", name: "เจริญ วงษ์ชุ่มเย็น", email: "charoen.vo@kmitl.ac.th" },
  { key: "kietikul", title: "รศ.ดร.", name: "เกียรติกูล เจียรนัยธนะกิจ", email: "kietikul.je@kmitl.ac.th" },
  { key: "orachat", title: "รศ.ดร.", name: "อรฉัตร จิตต์โสภักตร์", email: "orachat.ch@kmitl.ac.th" },
  { key: "rathachai", title: "รศ.ดร.", name: "รัฐชัย ชาวอุทัย", email: "rathachai.ch@kmitl.ac.th" },
  { key: "surin", title: "รศ.ดร.", name: "สุรินทร์ กิตติธรกุล", email: "surin.ki@kmitl.ac.th" },
  { key: "aranya", title: "ผศ.ดร.", name: "อรัญญา วลัยรัชต์", email: "kwaranya@kmitl.ac.th" },
  { key: "chompoonuch", title: "ผศ.ดร.", name: "ชมพูนุท เต็งเจริญ", email: "chompoonuch.te@kmitl.ac.th" },
  { key: "chutimet", title: "ผศ.ดร.", name: "ชุติเมษฏ์ ศรีนิลทา", email: "kschutim@kmitl.ac.th" },
  { key: "pakorn", title: "ผศ.ดร.", name: "ปกรณ์ วัฒนจตุรพร", email: "pakorn.wa@kmitl.ac.th" },
  { key: "phongsak", title: "ผศ.ดร.", name: "พงษ์ศักดิ์ กีรติวินทกร", email: "phongsak.ke@kmitl.ac.th" },
  { key: "thanunchai", title: "ผศ.ดร.", name: "ธนัญชัย ตรีภาค", email: "thanunchai.th@kmitl.ac.th" },
  { key: "akkradach", title: "ผศ.", name: "อัครเดช วัชระภูพงษ์", email: "kwakkrad@kmitl.ac.th" },
  { key: "bundit", title: "ผศ.", name: "บัณฑิต พัสยา", email: "bundit.pa@kmitl.ac.th" },
  { key: "kiatnarong", title: "ผศ.", name: "เกียรติณรงค์ ทองประเสริฐ", email: "kiatnarong.to@kmitl.ac.th" },
  { key: "sorayut", title: "ผศ.", name: "สรยุทธ กลมกล่อม", email: "sorayut.gl@kmitl.ac.th" },
  { key: "thana", title: "ผศ.", name: "ธนา หงษ์สุวรรณ", email: "khthana@kmitl.ac.th" },
  { key: "jirayu", title: "ดร.", name: "จิรายุ เพชรแหน", email: "jirayu.pe@kmitl.ac.th" },
  { key: "parinya", title: "ดร.", name: "ปริญญา เอกปริญญา", email: "parinya.ek@kmitl.ac.th" },
  { key: "kanut", title: "อ.", name: "คณัฐ ตังติสานนท์", email: "ktkanut@kmitl.ac.th" },
  { key: "watjanapong", title: "อ.", name: "วัจนพงศ์ เกษมศิริ", email: "watjanapong.ka@kmitl.ac.th" },
  { key: "jirasak", name: "จิระศักดิ์ สิทธิกร", email: "jirasak.si@kmitl.ac.th", madeUp: true },
];

/** The demo account (one sign-in, admin / teacher / student) — Moodle lists him as the teacher of Computer Programming. */
export const DEMO_TEACHER = "kiatnarong";

/** From the Moodle front page: these subjects (by code) belong to these teachers. */
export const KNOWN: Record<string, string> = {
  "01076112": "kiatnarong",   // การเขียนโปรแกรมคอมพิวเตอร์ — "Computer Programming"
  "01078112": "kanut",        // Computer Programming (CEI, English) — "Computer Programming (Python)" (an inference)
  "01076232": "surin",        // สถาปัตยกรรมคอมพิวเตอร์ — "Computer Organization and Assembly Language"
  "01076341": "jirasak",      // เครือข่ายคอมพิวเตอร์ — "Data Communication" / "Internetworking Standards and Technologies"
};
/** The demo teacher also keeps what the old demo teacher taught, so the demo account still has a full list of courses. */
const DEMO_ALSO = ["01076215", "01076321"];

/** INVENTED: the other subject families, one per teacher, handed out in this order down the page's list (the head and the teachers who
 *  already have a known subject are skipped). A family is a list of subject keys (a code, or the course name for the two courses with none). */
export const FAMILIES: string[][] = [
  ["01076371"],                                                                            // embedded systems
  ["01077351", "01078351"],                                                                // human-computer interaction
  ["01076114"],                                                                            // discrete structures
  ["01076351", "หัวข้อพิเศษ: ปัญญาประดิษฐ์เชิงสร้างสรรค์สำหรับงานวิศวกรรมซอฟต์แวร์"],     // software engineering + the AI special topic
  ["01076241"],                                                                            // operating systems
  ["01076355", "01077355", "01078365"],                                                    // UX/UI — taught by chompoonuch.te (the user's own change, 15/10/2569: this family sits in the slot that reaches her)
  ["01076231"],                                                                            // digital logic
  ["01077421"],                                                                            // cyber security
  ["01076497"],                                                                            // computer engineering project
  ["01077113"],                                                                            // object-oriented programming
  ["เวิร์กชอป Git และ GitHub"],                                                            // Git workshop
];

// ids: the six ids the mock already used stay (t-mock-1 = the demo teacher), the rest continue from 9 (4 and 5 were never used)
const IDS = [1, 2, 3, 6, 7, 8, ...Array.from({ length: 30 }, (_, i) => 9 + i)];

interface Course { id: string; code?: string; name: string }
interface MockTeacher { id: string; title?: string; name: string; email: string; role: "teacher"; status: "active"; courseIds: string[] }

export function buildTeachers(courses: Course[]): MockTeacher[] {
  const subjectOf = (c: Course) => c.code ?? c.name;
  const owner = new Map<string, string>();                 // subject key → teacher key
  for (const [code, who] of Object.entries(KNOWN)) owner.set(code, who);
  for (const code of DEMO_ALSO) owner.set(code, DEMO_TEACHER);
  const free = REAL_TEACHERS.filter((t) => t.key !== "amnach" && t.key !== DEMO_TEACHER && !Object.values(KNOWN).includes(t.key));
  FAMILIES.forEach((fam, i) => fam.forEach((k) => owner.set(k, free[i].key)));

  const missing = courses.filter((c) => !owner.has(subjectOf(c)));
  if (missing.length) throw new Error("no teacher for: " + [...new Set(missing.map(subjectOf))].join(", "));

  // the demo teacher first, then the page's order
  const ordered = [REAL_TEACHERS.find((t) => t.key === DEMO_TEACHER)!, ...REAL_TEACHERS.filter((t) => t.key !== DEMO_TEACHER)];
  const num = (id: string) => Number(id.replace(/\D/g, ""));
  return ordered.map((t, i) => ({
    id: `t-mock-${IDS[i]}`,
    ...(t.title ? { title: t.title } : {}),
    name: t.name,
    email: t.email,
    role: "teacher" as const,
    status: "active" as const,
    courseIds: courses.filter((c) => owner.get(subjectOf(c)) === t.key).map((c) => c.id).sort((a, b) => num(a) - num(b)),
  }));
}

const isMain = (process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/build-real-teachers.ts");
if (isMain) {
  const courses = Object.values(JSON.parse(fs.readFileSync("public/mock-data/courses-mockup.json", "utf8"))) as Course[];
  const teachers = buildTeachers(courses);
  for (const dir of ["public/mock-data", "test-data"]) {
    for (const f of ["teachers-mockup.json", "teachers-mockup-en.json"]) fs.writeFileSync(`${dir}/${f}`, JSON.stringify(teachers, null, 2) + "\n");
  }
  console.log(`${teachers.length} teachers written; ${teachers.filter((t) => t.courseIds.length === 0).length} have no course`);
}
