import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execSync } from "node:child_process";

import { parseRoster, buildClass, type Flow } from "../scripts/build-local-class";

// 15/10/2569 — the real class list is turned into a LOCAL-ONLY copy of c-mock-1 (the repo is public). These specs run on a made-up sheet in the
// registrar's format: they guard the converter and the demo-student swap, never real names. The data files themselves must stay out of git.

const HEADER = "ลำดับที่,รหัส น.ศ.,ชื่อ-นามสกุล,ลายเซ็น,กลางภาค,ปลายภาค,รวม,เกรด";
const PAGE = (group: number, rows: string[]) => [",,,,,,,หน้า: 1/1", "สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง", "รหัสวิชา01076311,, ชื่อวิชา PROJECT 1,,,,,", `หน่วยกิต 3,,กลุ่ม ${group},วันสอบ อา.  เวลาสอบ -,,,,`, HEADER, ...rows, ",,,,วันที่ออกรายงาน 15 ตุลาคม 2569"].join("\r\n");
// fake people: ids 99xxxxxx never exist in the mock
const FAKE = [["99000001", "นาย", "ทดสอบ", "หนึ่ง"], ["99000002", "นางสาว", "ตัวอย่าง", "สอง"], ["99000003", "นาย", "ปลอม", "สาม"], ["99000004", "นางสาว", "สมมติ", "สี่"], ["99000005", "นาย", "จำลอง", "ห้า"]];
const row = (n: number, p: string[]) => `${n},${p[0]}, ${p[1]}${p[2]}  ${p[3]},,,,,`;
const SHEET = "\uFEFF" + PAGE(1, FAKE.map((p, i) => row(i + 3, p))) + "\r\n" + PAGE(2, [row(1, ["99000006", "นางสาว", "แยกกลุ่ม", "หก"])]) + "\r\n,,รวมจำนวนนักศึกษา  , 6  คน\r\n";
const flow = JSON.parse(fs.readFileSync("public/mock-data/student-flow-mockup.json", "utf8")) as Flow;

test.describe("the sheet reader", () => {
  test("reads the course, each student's title / first / last name, and which group follows each 'กลุ่ม N'", () => {
    const r = parseRoster(SHEET);
    expect(r.code).toBe("01076311");
    expect(r.students).toHaveLength(6);
    expect(r.students[0]).toEqual({ studentId: "99000001", title: "นาย", name: "ทดสอบ หนึ่ง", group: 1 });
    expect(r.students[1].title).toBe("นางสาว");
    expect(r.students.filter((s) => s.group === 1)).toHaveLength(5);
    expect(r.students[5]).toMatchObject({ studentId: "99000006", group: 2 });
  });
  test("page headers, the column header and the signature lines are not read as students", () => {
    expect(parseRoster(SHEET).students.map((s) => s.studentId)).toEqual(["99000001", "99000002", "99000003", "99000004", "99000005", "99000006"]);
  });
});

test.describe("the class built from it", () => {
  const build = () => buildClass(parseRoster(SHEET), flow, { demoTo: "99000003" });

  test("section 1 gets its students, section 2 (a second course of the subject) gets the other group", () => {
    const c = build();
    expect(c.courseStudents.filter((s) => s.courseId === "c-mock-1").map((s) => s.studentId)).toEqual(["99000001", "99000002", "99000003", "99000004", "99000005"]);
    expect(c.courseStudents.filter((s) => s.courseId === "c-mock-7").map((s) => s.studentId)).toEqual(["99000006"]);
    expect(c.cohortStudents).toHaveLength(6);
    expect(c.cohortStudents.every((s) => s.program === "CE" && s.email === `${s.studentId}@kmitl.ac.th`)).toBe(true);
  });

  test("the demo student's own marks move to the chosen student, and nobody else gets them", () => {
    const c = build();
    const mine = (id: string) => c.submissions.filter((s) => s.studentId === id);
    const was = flow.submissions.filter((s) => s.studentId === "69070101");
    expect(mine("99000003").map((s) => s.assignmentId).sort()).toEqual(was.map((s) => s.assignmentId).sort());
    for (const w of was) {
      const moved = mine("99000003").find((s) => s.assignmentId === w.assignmentId)!;
      for (const k of ["aiScore", "instructorScore", "status", "criterionScores", "instructorComment"]) expect(moved[k]).toEqual(w[k]);
    }
    expect(c.submissions.some((s) => s.studentId === "69070101")).toBe(false);
    expect(c.demo).toMatchObject({ from: "69070101", studentId: "99000003", email: "99000003@kmitl.ac.th" });
  });

  test("every other student borrows one mock student's marks whole, so the mock's rules still hold (criterion points add up to the total)", () => {
    const c = build();
    for (const s of c.courseStudents.filter((x) => x.courseId === "c-mock-1")) {
      const subs = c.submissions.filter((x) => x.studentId === s.studentId);
      expect(subs.length).toBeGreaterThan(0);
      for (const sub of subs) {
        expect(sub.studentName).toBe(s.name);
        const cs = sub.criterionScores as Record<string, number> | undefined;
        if (cs && sub.status === "graded" && typeof sub.instructorScore === "number") expect(Object.values(cs).reduce((a, b) => a + b, 0)).toBe(sub.instructorScore);
      }
    }
    expect(new Set(c.submissions.map((x) => x.id)).size).toBe(c.submissions.length);                  // ids are unique
    expect(c.submissions.filter((x) => x.assignmentId === "a-mock-5")).toHaveLength(5);              // the midterm: a score for every student
  });

  test("the same sheet always gives the same class", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  test("a demo student who is not in section 1 is refused", () => {
    expect(() => buildClass(parseRoster(SHEET), flow, { demoTo: "99000006" })).toThrow(/section 1/);
    expect(() => buildClass(parseRoster(SHEET), flow, { demoTo: "11111111" })).toThrow(/not in the roster/);
  });
});

test.describe("the demo student swap", () => {
  const withStorage = async (value: string | null, run: () => void) => {
    const g = globalThis as unknown as { localStorage?: unknown };
    const before = g.localStorage;
    g.localStorage = { getItem: (k: string) => (k === "hwai_demo_student" ? value : null) };
    try { run(); } finally { g.localStorage = before; }
  };
  test("without the key the multi-role account acts as the mock student; with it, as the swapped one", async () => {
    const { findMultiRoleAccount, identityEmail } = await import("../src/lib/accounts");
    await withStorage(null, () => expect(findMultiRoleAccount("kiatnarong.to@kmitl.ac.th")?.studentId).toBe("69070101"));
    await withStorage(JSON.stringify({ studentId: "99000003", name: "ปลอม สาม" }), () => {
      const a = findMultiRoleAccount("kiatnarong.to@kmitl.ac.th")!;
      expect(a.studentId).toBe("99000003");
      expect(identityEmail(a, "student")).toBe("99000003@kmitl.ac.th");
      expect(identityEmail(a, "teacher")).toBe("kiatnarong.to@kmitl.ac.th");
    });
    await withStorage("not json", () => expect(findMultiRoleAccount("kiatnarong.to@kmitl.ac.th")?.studentId).toBe("69070101"));
  });
});

test("the real data never reaches git: the folders it lives in are ignored, and nothing under them is tracked", () => {
  execSync("git check-ignore -q local-data/real-roster.csv");
  execSync("git check-ignore -q public/local-data/real-class.json");
  expect(execSync("git ls-files local-data public/local-data").toString().trim()).toBe("");
});
