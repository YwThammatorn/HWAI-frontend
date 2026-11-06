import { test, expect } from "@playwright/test";
import fs from "node:fs";

import { REAL_TEACHERS, KNOWN, DEMO_TEACHER, buildTeachers } from "../scripts/build-real-teachers";
import { findMultiRoleAccount } from "../src/lib/accounts";

// 15/10/2569 — the mock's teachers are the real teachers of the CE department (public page https://www.ce.kmitl.ac.th/FacultyMem). Which subject
// each teaches is invented except the four the department's Moodle shows (see scripts/build-real-teachers.ts). These guard the data.

interface T { id: string; title?: string; name: string; email: string; status: string; courseIds: string[] }
interface C { id: string; code?: string; name: string; academicYear: number; term: number; sectionNumber: string }
const read = <X>(p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as X;
const TEACHERS = read<T[]>("public/mock-data/teachers-mockup.json");
const COURSES = Object.values(read<Record<string, C>>("public/mock-data/courses-mockup.json"));
const ownerOf = (courseId: string) => TEACHERS.filter((t) => t.courseIds.includes(courseId));

test("the four files agree, and are exactly what the generator writes (nothing edited by hand)", () => {
  for (const f of ["public/mock-data/teachers-mockup-en.json", "test-data/teachers-mockup.json", "test-data/teachers-mockup-en.json"]) expect(read<T[]>(f)).toEqual(TEACHERS);
  expect(TEACHERS).toEqual(JSON.parse(JSON.stringify(buildTeachers(COURSES))));
});

test("22 teachers: the head of department and the 21 อาจารย์, unique ids and e-mails, only published kmitl addresses, no staff", () => {
  expect(TEACHERS).toHaveLength(22);
  expect(new Set(TEACHERS.map((t) => t.id)).size).toBe(22);
  expect(new Set(TEACHERS.map((t) => t.email)).size).toBe(22);
  for (const t of TEACHERS) {
    expect(t.email).toMatch(/^[a-z0-9.]+@kmitl\.ac\.th$/);                                  // lower case, kmitl only: no gmail / hotmail, no "[at]"
    expect("role" in t).toBe(false);                                                         // a teacher account is a teacher (no account role, 7/11/2569)
    expect(t.status).toBe("active");
    if (t.title) expect(["ผศ.ดร.", "รศ.ดร.", "ผศ.", "ดร.", "อ."]).toContain(t.title);        // the app's own prefixes (lib/managed-teachers.ts)
    expect(t.name).toMatch(/^[\u0E00-\u0E7F]+ [\u0E00-\u0E7F]+$/);                          // Thai first + last name, whatever the language
  }
  expect(TEACHERS.some((t) => t.name === "อำนาจ ขาวเน" && t.title === "ผศ.ดร.")).toBe(true);   // the head of department is a teacher too
  for (const staff of ["อมต", "ณัฐกิตติ์", "อวยพร", "กนกทิพย์"]) expect(TEACHERS.some((t) => t.name.includes(staff))).toBe(false);
  expect(REAL_TEACHERS.filter((t) => t.madeUp).map((t) => t.email)).toEqual(["jirasak.si@kmitl.ac.th"]);   // the one address not on the page is marked
});

test("every course has exactly one teacher, and a subject taught in a term has the same teacher in all its sections", () => {
  for (const c of COURSES) expect(ownerOf(c.id), c.id).toHaveLength(1);
  const groups = new Map<string, Set<string>>();
  for (const c of COURSES) {
    const k = `${c.code ?? c.name}|${c.academicYear}|${c.term}`;
    groups.set(k, (groups.get(k) ?? new Set()).add(ownerOf(c.id)[0].id));
  }
  for (const [k, owners] of groups) expect(owners.size, k).toBe(1);
});

test("what the department's Moodle shows holds: Programming, Computer Programming (CEI), Computer Organization, Networks", () => {
  const teacherOf = (code: string) => [...new Set(COURSES.filter((c) => c.code === code).map((c) => ownerOf(c.id)[0].email))];
  expect(teacherOf("01076112")).toEqual(["kiatnarong.to@kmitl.ac.th"]);
  expect(teacherOf("01078112")).toEqual(["ktkanut@kmitl.ac.th"]);
  expect(teacherOf("01076232")).toEqual(["surin.ki@kmitl.ac.th"]);
  expect(teacherOf("01076341")).toEqual(["jirasak.si@kmitl.ac.th"]);
  expect(Object.keys(KNOWN).sort()).toEqual(["01076112", "01076232", "01076341", "01078112"]);
});

test("the demo account (admin + teacher + student) is the teacher of the demo class, and t-mock-1 in the mock", () => {
  const account = findMultiRoleAccount("kiatnarong.to@kmitl.ac.th")!;
  expect(account.roles).toEqual(["admin", "teacher", "student"]);
  expect(account.name).toBe(TEACHERS[0].name);
  expect(TEACHERS[0]).toMatchObject({ id: "t-mock-1", email: account.email });
  expect(REAL_TEACHERS.find((t) => t.key === DEMO_TEACHER)!.email).toBe(account.email);
  expect(TEACHERS[0].courseIds).toContain("c-mock-1");                                      // the demo account sees the demo class
  expect(findMultiRoleAccount("somsak.c@kmitl.ac.th")).toBeUndefined();                     // the old fake demo account is gone
});

test("every UX/UI course (01076355, 01077355, 01078365) is taught by chompoonuch.te@kmitl.ac.th — the user's own change, 15/10/2569", () => {
  const ux = COURSES.filter((c) => ["01076355", "01077355", "01078365"].includes(c.code ?? ""));
  expect(ux.length).toBeGreaterThanOrEqual(4);
  expect(ux.some((c) => c.id === "c-mock-4")).toBe(true);
  for (const c of ux) expect(ownerOf(c.id).map((t) => t.email), c.id).toEqual(["chompoonuch.te@kmitl.ac.th"]);
  expect(TEACHERS.find((t) => t.email === "chompoonuch.te@kmitl.ac.th")!.courseIds).toEqual(expect.arrayContaining(ux.map((c) => c.id)));
});
