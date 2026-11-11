import { test, expect } from "@playwright/test";
import fs from "fs";
import { levelPoints } from "../src/lib/rubricTemplates";

// 15/10/2569 — the UX/UI class of the mock (c-mock-4, taught by chompoonuch.te): the 20 assignments of the Classroom screenshot + the Final project,
// Thai rubrics, six teams for the group work, five CLOs, and what the 30 students handed in. Built by scripts/build-uxui-class.ts; loaded by console command [16].
const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

type Level = { label: string; description: string };
type Crit = { id: string; name: string; description: string; maxPoints: number; weight: number; levels: Level[]; cloIds?: string[] };
type Rubric = { id: string; assignmentId: string; name: string; criteria: Crit[] };
type Asg = { id: string; courseId: string; name: string; maxPoints: number; dueDate: string; categoryId: string; submissionType: string; maxGroupSize: number | null; rubricIds: string[]; gradingFinalized?: boolean };
type Sub = { id: string; assignmentId: string; studentId: string; status: string; submittedAt: string; instructorScore: number | null; aiScore: number | null; criterionScores?: Record<string, number>; groupId?: string; late?: boolean; instructorComment?: string };
type Group = { id: string; assignmentId: string; courseId: string; name: string; memberStudentIds: string[] };
type Clo = { id: string; courseId: string; code: string; text: string };

const th = rd("student-uxui-mockup.json"), en = rd("student-uxui-mockup-en.json");
const asg = th.assignments as Asg[], rubrics = th.rubrics as Rubric[], subs = th.submissions as Sub[], groups = th.groups as Group[], clos = th.clos as Clo[];
const students = (th.courseStudents as { studentId: string }[]).map((s) => s.studentId);
const THAI = /[฀-๿]/;
const byId = (id: string) => asg.find((a) => a.id === id)!;
const rows = (id: string) => subs.filter((s) => s.assignmentId === id);

const PICTURE: [string, string, "individual" | "group", number][] = [
  ["a-uxui-1", "UX Principles", "individual", 5], ["a-uxui-2", "Brand & Tone", "individual", 3], ["a-uxui-3", "Neilsen's 10 Heuristics", "individual", 5], ["a-uxui-4", "Persona", "individual", 5],
  ["a-uxui-5", "Empathy Map", "group", 6], ["a-uxui-6", "User Interview", "group", 10], ["a-uxui-7", "User / Context / Content", "group", 10], ["a-uxui-8", "How Might We", "group", 13],
  ["a-uxui-9", "Crazy Idea", "group", 10], ["a-uxui-10", "Card sorting", "group", 5], ["a-uxui-11", "Sitemap", "group", 5], ["a-uxui-12", "Wireframe and Wireflow", "group", 10],
  ["a-uxui-13", "UI design", "individual", 10], ["a-uxui-14", "Web/App comparing", "group", 10], ["a-uxui-15", "App UX Teardown", "group", 10], ["a-uxui-16", "Hooked", "individual", 10],
  ["a-uxui-17", "Reorder / Redesign UI", "group", 13], ["a-uxui-18", "Usability Testing", "individual", 10], ["a-uxui-19", "Flower workshop", "individual", 4], ["a-uxui-20", "ส่งเอกสาร Final project", "group", 10],
];
const GROUP_IDS = PICTURE.filter((p) => p[2] === "group").map((p) => p[0]);

test.describe("the UX/UI class mock", () => {
  test("the course: 30 CE students, the 20 assignments of the picture and the Final project, no exam", () => {
    expect(students).toHaveLength(30);
    expect(new Set(students).size).toBe(30);
    expect(th.courseStudents.every((s: { courseId: string }) => s.courseId === "c-mock-4")).toBe(true);
    expect(asg).toHaveLength(21);
    for (const [id, name, type, points] of PICTURE) expect(byId(id), id).toMatchObject({ courseId: "c-mock-4", name, submissionType: type, maxPoints: points });
    expect(byId("a-mock-10")).toMatchObject({ courseId: "c-mock-4", submissionType: "individual", maxPoints: 75, dueDate: "2026-10-05" });
    expect(asg.some((a) => /exam|สอบ/i.test(a.name))).toBe(false);                       // this course has no midterm / final exam
    expect(th.gradingCategories.some((c: { name: string }) => /exam|สอบ/i.test(c.name))).toBe(false);
    expect(th.gradingCategories.reduce((n: number, c: { weight: number }) => n + c.weight, 0)).toBe(100);
    const cat = new Set(th.gradingCategories.map((c: { id: string }) => c.id));
    for (const a of asg) expect(cat.has(a.categoryId), a.id).toBe(true);
    expect(new Set(asg.map((a) => a.id)).size).toBe(21);
  });

  test("every assignment has one Thai rubric: four levels, criteria of at least 3 points that add up, each tagged with CLOs of the course", () => {
    expect(rubrics).toHaveLength(21);
    const cloIds = new Set(clos.map((c) => c.id));
    for (const a of asg) {
      const r = rubrics.filter((x) => x.assignmentId === a.id);
      expect(r, a.id).toHaveLength(1);
      expect(a.rubricIds).toEqual([r[0].id]);
      expect(r[0].criteria.reduce((n, c) => n + c.maxPoints, 0), a.id).toBe(a.maxPoints);
      r[0].criteria.forEach((c, i) => {
        expect(c.name.startsWith(`C${i + 1} · `), c.name).toBe(true);
        expect(THAI.test(c.name) && THAI.test(c.description), c.id).toBe(true);
        expect(c.maxPoints, c.id).toBeGreaterThanOrEqual(3);                              // a 2-point criterion would collapse 2/1/1/0
        expect(c.levels.map((l) => l.label)).toEqual(["ดีมาก", "พอใช้", "ต้องปรับปรุง", "ไม่ผ่าน"]);
        for (const l of c.levels) expect(THAI.test(l.description) && l.description.length > 15, `${c.id} ${l.label}`).toBe(true);
        expect(new Set(c.levels.map((l) => l.description)).size).toBe(4);
        expect((c.cloIds ?? []).length, c.id).toBeGreaterThan(0);
        for (const id of c.cloIds ?? []) expect(cloIds.has(id), `${c.id} → ${id}`).toBe(true);
      });
    }
    // 'the teacher never wrote English' for the 20 assignments: no criterion name is Latin-only
    for (const a of asg.filter((x) => x.id !== "a-mock-10")) for (const c of rubrics.find((r) => r.assignmentId === a.id)!.criteria) expect(c.name.replace(/^C\d+ · /, ""), c.id).toMatch(THAI);
  });

  test("group work carries a team criterion tagged CLO5 (the small ones — 5 or 6 points — have no room for it); the Final project is the file's seven criteria (75 points) with the file's CLO tags", () => {
    let withTeam = 0;
    for (const id of GROUP_IDS) {
      const team = rubrics.find((r) => r.assignmentId === id)!.criteria.filter((c) => /ทีม/.test(c.name));
      for (const c of team) expect(c.cloIds, c.id).toContain("clo-uxui-5");
      if (team.length) withTeam++;
      if (byId(id).maxPoints <= 6) expect(team, id).toHaveLength(0);
    }
    expect(withTeam).toBeGreaterThanOrEqual(7);
    const f = rubrics.find((r) => r.id === "r-mock-10")!;
    expect(f.criteria.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `rc-uxui-${n}`));
    expect(f.criteria.map((c) => c.maxPoints)).toEqual([10, 15, 10, 10, 10, 10, 10]);
    expect(f.criteria.map((c) => (c.cloIds ?? []).map((x) => x.replace("clo-uxui-", "")).join(","))).toEqual(["2,3", "1,3", "1,3", "1,3", "1,3", "3", "1,3,4"].map((x) => x));
    expect(f.criteria.map((c) => c.weight)).toEqual([13, 20, 13, 13, 13, 13, 13]);        // round(points / 75 × 100)
  });

  test("five CLOs of the course, in Thai", () => {
    expect(clos.map((c) => c.code)).toEqual(["CLO1", "CLO2", "CLO3", "CLO4", "CLO5"]);
    expect(clos.every((c) => c.courseId === "c-mock-4" && THAI.test(c.text))).toBe(true);
  });

  test("individual work: each student at most once, a few missing; the Final project keeps its 27 hand-ins", () => {
    for (const a of asg.filter((x) => x.submissionType === "individual")) {
      const r = rows(a.id);
      expect(new Set(r.map((x) => x.studentId)).size, a.id).toBe(r.length);
      expect(r.every((x) => students.includes(x.studentId)), a.id).toBe(true);
      expect(r.length, a.id).toBeLessThanOrEqual(30);
      if (a.id === "a-mock-10") expect(r).toHaveLength(27);
      else expect(r.length, a.id).toBeGreaterThanOrEqual(25);
      expect(r.every((x) => !x.groupId), a.id).toBe(true);
    }
    expect(subs.some((s) => s.assignmentId !== "a-mock-10" && asg.find((a) => a.id === s.assignmentId)?.submissionType === "individual")).toBe(true);
  });

  test("group work: six teams of five cover the class once; every member has a row with the team's marks; the two ideation workshops use re-mixed teams", () => {
    const partition = (id: string) => groups.filter((g) => g.assignmentId === id).map((g) => [...g.memberStudentIds].sort().join("+")).sort().join("|");
    for (const id of GROUP_IDS) {
      const gs = groups.filter((g) => g.assignmentId === id);
      expect(gs, id).toHaveLength(6);
      expect(gs.every((g) => g.courseId === "c-mock-4" && g.memberStudentIds.length === 5), id).toBe(true);
      expect(gs.flatMap((g) => g.memberStudentIds).sort(), id).toEqual([...students].sort());
      expect(byId(id).maxGroupSize).toBe(5);
      const r = rows(id);
      expect(r, id).toHaveLength(30);
      for (const g of gs) {
        const mine = r.filter((x) => x.groupId === g.id);
        expect(mine.map((x) => x.studentId).sort(), `${id} ${g.name}`).toEqual([...g.memberStudentIds].sort());
        expect(new Set(mine.map((x) => x.instructorScore)).size).toBe(1);
        expect(new Set(mine.map((x) => JSON.stringify(x.criterionScores))).size).toBe(1);
        expect(new Set(mine.map((x) => x.submittedAt)).size).toBe(1);
      }
    }
    expect(new Set(groups.map((g) => g.id)).size).toBe(72);
    const normal = partition("a-uxui-5");
    for (const id of GROUP_IDS.filter((x) => x !== "a-uxui-8" && x !== "a-uxui-9")) expect(partition(id), id).toBe(normal);
    expect(partition("a-uxui-8")).not.toBe(normal);
    expect(partition("a-uxui-8")).toBe(partition("a-uxui-9"));
  });

  test("Done late: only the document (2 teams) and Wireframe (1 team), each inside the one-hour window after the deadline", () => {
    const late = subs.filter((s) => s.late);
    expect([...new Set(late.map((s) => s.assignmentId))].sort()).toEqual(["a-uxui-12", "a-uxui-20"]);
    expect(new Set(late.filter((s) => s.assignmentId === "a-uxui-20").map((s) => s.groupId)).size).toBe(2);
    expect(new Set(late.filter((s) => s.assignmentId === "a-uxui-12").map((s) => s.groupId)).size).toBe(1);
    for (const s of subs) {
      const deadline = Date.parse(`${byId(s.assignmentId).dueDate}T23:59:59+07:00`);
      const t = Date.parse(s.submittedAt);
      if (s.late) { expect(t, s.id).toBeGreaterThan(deadline); expect(t, s.id).toBeLessThanOrEqual(deadline + 3_600_000); }
      else expect(t, s.id).toBeLessThanOrEqual(deadline);
    }
  });

  test("marks are built from rubric levels and add up; nobody gets full marks on an assignment worth 10 or more; the AI's marks are close but not identical", () => {
    let differs = 0;
    for (const s of subs) {
      const a = byId(s.assignmentId), r = rubrics.find((x) => x.assignmentId === a.id)!;
      if (s.status === "graded") {
        for (const c of r.criteria) expect([0, 1, 2, 3].map((i) => levelPoints(c.maxPoints, i)), `${s.id}/${c.id}`).toContain(s.criterionScores![c.id]);
        expect(r.criteria.reduce((n, c) => n + s.criterionScores![c.id], 0), s.id).toBe(s.instructorScore);
        if (a.maxPoints >= 10) expect(s.instructorScore, s.id).toBeLessThan(a.maxPoints);
        if (s.aiScore !== s.instructorScore) differs++;
      } else {
        expect(s.instructorScore, s.id).toBeNull();
      }
    }
    expect(differs).toBeGreaterThan(20);
    const avg = (id: string) => { const g = rows(id).filter((x) => x.status === "graded"); return g.reduce((n, x) => n + x.instructorScore!, 0) / g.length / byId(id).maxPoints; };
    for (const a of asg) { expect(avg(a.id), a.id).toBeGreaterThan(0.5); expect(avg(a.id), a.id).toBeLessThan(0.95); }
  });

  test("announced results: everything except Hooked, Usability Testing and Reorder / Redesign UI; the last two still have work waiting for the teacher", () => {
    const open = asg.filter((a) => !a.gradingFinalized).map((a) => a.id).sort();
    expect(open).toEqual(["a-uxui-16", "a-uxui-17", "a-uxui-18"]);
    for (const id of ["a-uxui-17", "a-uxui-18"]) {
      const st = new Set(rows(id).map((x) => x.status));
      expect(st.has("need_review") && st.has("not_graded") && st.has("graded"), id).toBe(true);
    }
    for (const a of asg.filter((x) => x.gradingFinalized)) expect(rows(a.id).every((x) => x.status === "graded"), a.id).toBe(true);
  });

  test("the main demo student's work shown in the report carries a teacher comment (11/11/2569): UI design, his team's How Might We, and the Final project — and the marks did not move", () => {
    const mine = (id: string) => subs.find((s) => s.assignmentId === id && s.studentId === "69070101")!;
    for (const id of ["a-uxui-13", "a-uxui-8", "a-mock-10"]) {
      expect(mine(id).status, id).toBe("graded");
      expect((mine(id).instructorComment ?? "").length, id).toBeGreaterThan(20);
    }
    expect([mine("a-uxui-13").instructorScore, mine("a-uxui-8").instructorScore, mine("a-mock-10").instructorScore]).toEqual([9, 12, 58]);
    // a team's comment is one comment: every member of his How Might We team has it
    const team = subs.filter((s) => s.assignmentId === "a-uxui-8" && s.groupId === mine("a-uxui-8").groupId);
    expect(team).toHaveLength(5);
    for (const m of team) expect(m.instructorComment).toBe(mine("a-uxui-8").instructorComment);
  });

  test("the main demo student (69070101) did well on the Final project, as before", () => {
    const mine = subs.find((s) => s.id === "sub-uxui-69070101")!;
    expect(mine.instructorScore!).toBeGreaterThan(75 * 0.7);
    expect(mine.instructorScore!).toBeLessThan(75);
  });

  test("the Thai and English files carry the same class, and the public and test-data copies are identical", () => {
    for (const k of ["gradingCategories", "assignments", "rubrics", "submissions", "groups", "clos", "courseStudents"]) expect(en[k], k).toEqual(th[k]);
    for (const n of ["student-uxui-mockup", "student-uxui-mockup-en"]) expect(fs.readFileSync(`test-data/${n}.json`, "utf8"), n).toBe(fs.readFileSync(`public/mock-data/${n}.json`, "utf8"));
  });
});
