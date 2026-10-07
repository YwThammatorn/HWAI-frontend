import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import { LEVEL_LABELS, levelPoints, allocatePoints, buildCriteria, pickAiTemplate, UXUI_FINAL, SUBJECTS, quizCriteria, examCriteria } from "../src/lib/rubricTemplates";

const BASE = "http://localhost:3000";
const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

// 4/10/2569 — every rubric in the demo data (and what the AI Rubric Assistant suggests) follows the format of the
// UX/UI Final Project rubric file (UXUI_Final_Rubric_draft1.xlsx): criteria C1…, four levels (ดีมาก / พอใช้ /
// ต้องปรับปรุง / ไม่ผ่าน), and a score for each level — 100% / 66.67% / 33.33% / 0% of the criterion's full marks.

test.describe("the rubric file's rules", () => {
  test("level → points: 15 → 15/10/5/0 (the file's example sheet), 10 → 10/7/3/0", () => {
    expect([0, 1, 2, 3].map((i) => levelPoints(15, i))).toEqual([15, 10, 5, 0]);
    expect([0, 1, 2, 3].map((i) => levelPoints(10, i))).toEqual([10, 7, 3, 0]);
    expect(LEVEL_LABELS.th).toEqual(["ดีมาก", "พอใช้", "ต้องปรับปรุง", "ไม่ผ่าน"]);
  });

  test("the UX/UI Final Project template is the file: 7 criteria, weights 15/15/10/15/15/15/15, its Thai wording", () => {
    const c = buildCriteria(UXUI_FINAL, 100, "th");
    expect(c.map((x) => x.maxPoints)).toEqual([15, 15, 10, 15, 15, 15, 15]);
    expect(c[0].name).toBe("C1 · ความครบถ้วนขององค์ประกอบและความสมจริงของเนื้อหา");
    expect(c[0].levels.map((l) => l.label)).toEqual(["ดีมาก", "พอใช้", "ต้องปรับปรุง", "ไม่ผ่าน"]);
    expect(c[0].levels[0].description).toBe("องค์ประกอบที่จำเป็นตามหน้าจอและงานที่กำหนดครบถ้วน เนื้อหามีความสมจริง ไม่พึ่ง Lorem Ipsum หรือข้อมูลตัวแทนมากเกินไป");
    expect(c[6].levels[3].description).toBe("ไม่สามารถทำ Core User Flow ให้สำเร็จได้ หรือ Prototype ขาดการเชื่อมโยงที่จำเป็น");
    const en = buildCriteria(UXUI_FINAL, 100, "en");
    expect(en[2].name).toBe("C3 · Spacing, Alignment & Grid Pattern");
    expect(en[0].levels.map((l) => l.label)).toEqual(["Excellent", "Fair", "Needs Improvement", "Fail"]);
  });

  test("points are split in proportion to the weights, whole numbers, never 0", () => {
    expect(allocatePoints(15, [60, 20, 20])).toEqual([9, 3, 3]);
    expect(allocatePoints(10, [40, 30, 30])).toEqual([4, 3, 3]);
    expect(allocatePoints(100, [15, 15, 10, 15, 15, 15, 15])).toEqual([15, 15, 10, 15, 15, 15, 15]);
    for (const total of [3, 7, 10, 25]) { const p = allocatePoints(total, [50, 30, 20]); expect(p.reduce((a, b) => a + b, 0)).toBe(total); expect(Math.min(...p)).toBeGreaterThan(0); }
  });

  test("every level of every subject template has its own wording (no empty or repeated level text)", () => {
    for (const lang of ["th", "en"] as const) {
      const sets = [UXUI_FINAL, ...Object.values(SUBJECTS).map((s) => s.lab), ...Object.values(SUBJECTS).flatMap((s) => [quizCriteria(s.topic), examCriteria(s.topic)])];
      for (const specs of sets) for (const c of buildCriteria(specs, 40, lang)) {
        expect(c.levels).toHaveLength(4);
        expect(new Set(c.levels.map((l) => l.description)).size, c.name).toBe(4);
        expect(c.levels.every((l) => l.description.trim().length > 10)).toBe(true);
      }
    }
  });

  test("the assistant picks by what was typed: UX/UI over exam over code; nothing specific → null", () => {
    expect(pickAiTemplate("Figma landing page")?.id).toBe("uxui");
    expect(pickAiTemplate("ออกแบบหน้าจอแอปจองห้อง")?.id).toBe("uxui");
    expect(pickAiTemplate("Final exam: design a UX flow in Python")?.id).toBe("uxui");
    expect(pickAiTemplate("Midterm quiz on loops")?.id).toBe("exam");
    expect(pickAiTemplate("แบบทดสอบย่อยเรื่องลูป")?.id).toBe("exam");
    expect(pickAiTemplate("Python lab on functions")?.id).toBe("programming");
    expect(pickAiTemplate("แล็บเขียนโปรแกรม")?.id).toBe("programming");
    expect(pickAiTemplate("Essay about the history of computing")).toBeNull();
    expect(pickAiTemplate("build a house")).toBeNull();   // "ui" inside "build" is not UI
  });
});

type Level = { label: string; description: string };
type Crit = { id: string; name: string; description: string; maxPoints: number; weight: number; levels: Level[] };
type Rubric = { id: string; assignmentId: string; criteria: Crit[] };
type Asg = { id: string; courseId: string; maxPoints: number; name: string; gradingFinalized?: boolean };
type Sub = { id: string; assignmentId: string; studentId: string; status: string; aiScore: number | null; instructorScore: number | null; criterionScores?: Record<string, number> };

for (const sfx of ["", "-en"]) {
  const lang = sfx ? "en" : "th";
  const flow = rd(`student-flow-mockup${sfx}.json`), hist = rd(`student-history-mockup${sfx}.json`), ux = rd(`student-uxui-mockup${sfx}.json`);
  const sets = [
    { name: "c-mock-1", asg: flow.assignments as Asg[], rubrics: flow.rubrics as Rubric[], subs: flow.submissions as Sub[] },
    { name: "earlier terms", asg: hist.assignments as Asg[], rubrics: hist.rubrics as Rubric[], subs: hist.submissions as Sub[] },
    { name: "UX/UI class", asg: ux.assignments as Asg[], rubrics: ux.rubrics as Rubric[], subs: ux.submissions as Sub[] },
  ];

  test.describe(`rubrics in the demo data (${lang === "th" ? "Thai" : "English"} files)`, () => {
    test("every rubric has 4 levels per criterion with the standard labels, and its criteria add up to the assignment", () => {
      let n = 0;
      for (const s of sets) for (const r of s.rubrics) {
        n++;
        expect(r.criteria.reduce((t, c) => t + c.maxPoints, 0), `${s.name} ${r.id}`).toBe(s.asg.find((a) => a.id === r.assignmentId)!.maxPoints);
        r.criteria.forEach((c, i) => {
          expect(c.name.startsWith(`C${i + 1} · `), c.name).toBe(true);
          expect(c.levels.map((l) => l.label), c.id).toEqual(LEVEL_LABELS[lang]);
          expect(c.levels.every((l) => l.description.length > 10), c.id).toBe(true);
        });
      }
      expect(n).toBe(7 + 45 + 1);
    });

    test("every graded score is built from levels: each criterion sits on one of its four steps, and the criteria add up to the score", () => {
      let n = 0;
      for (const s of sets) for (const sub of s.subs.filter((x) => x.status === "graded" && x.criterionScores)) {
        const r = s.rubrics.find((x) => x.assignmentId === sub.assignmentId)!;
        for (const c of r.criteria) expect([0, 1, 2, 3].map((i) => levelPoints(c.maxPoints, i)), `${sub.id}/${c.id}`).toContain(sub.criterionScores![c.id]);
        expect(r.criteria.reduce((t, c) => t + sub.criterionScores![c.id], 0), sub.id).toBe(sub.instructorScore);
        n++;
      }
      expect(n).toBe(175 + 48 + 27);
    });

    test("the content fits the subject: DSA labs measure algorithms, digital-logic labs circuits, c-mock-1 quizzes their topic", () => {
      const has = (courseId: string, piece: number, word: RegExp) => {
        const a = (hist.assignments as Asg[]).find((x) => x.courseId === courseId && x.id.endsWith(`-${piece}`))!;
        const r = (hist.rubrics as Rubric[]).find((x) => x.assignmentId === a.id)!;
        return r.criteria.some((c) => word.test(`${c.name} ${c.description}`));
      };
      expect(has("c-mock-40", 1, lang === "th" ? /อัลกอริทึม/ : /[Aa]lgorithm/)).toBe(true);
      expect(has("c-mock-41", 1, lang === "th" ? /วงจร/ : /[Cc]ircuit/)).toBe(true);
      expect(has("c-mock-44", 1, /SQL/)).toBe(true);
      expect(has("c-mock-38", 1, lang === "th" ? /โปรแกรม/ : /[Pp]rogram/)).toBe(true);
      expect(has("c-mock-41", 1, /SQL/)).toBe(false);
      const q2 = (flow.rubrics as Rubric[]).find((r) => r.assignmentId === "a-mock-6")!;
      expect(q2.criteria[0].name).toContain(lang === "th" ? "โครงสร้างข้อมูล" : "data structures");
    });
  });

  test.describe(`UX/UI class (${lang === "th" ? "Thai" : "English"} file)`, () => {
    const subs = ux.submissions as Sub[];
    test("30 CE students in c-mock-4, 27 graded + 3 not handed in; the assignment is announced and uses the file's 7 criteria", () => {
      expect(ux.courseStudents).toHaveLength(30);
      expect(new Set(ux.courseStudents.map((r: { studentId: string }) => r.studentId)).size).toBe(30);
      expect(ux.courseStudents.map((r: { sequenceNumber: number }) => r.sequenceNumber)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(ux.courseStudents.every((r: { courseId: string }) => r.courseId === "c-mock-4")).toBe(true);
      expect(subs).toHaveLength(27);
      const ids = new Set(ux.courseStudents.map((r: { studentId: string }) => r.studentId));
      for (const s of subs) expect(ids.has(s.studentId), s.id).toBe(true);
      expect(ids.has("69070101") && ids.has("67010201")).toBe(true);
      expect(ux.assignments[0]).toMatchObject({ id: "a-mock-10", courseId: "c-mock-4", maxPoints: 100, gradingFinalized: true, rubricIds: ["r-mock-10"] });
      expect(ux.rubrics[0].criteria.map((c: Crit) => c.maxPoints)).toEqual([15, 15, 10, 15, 15, 15, 15]);
      expect(ux.gradingCategories.reduce((n: number, c: { weight: number }) => n + c.weight, 0)).toBe(100);
    });

    test("the scores look like a class: average 65–80, nobody perfect, nobody near zero, a spread across all four levels", () => {
      const t = subs.map((s) => s.instructorScore!);
      const mean = t.reduce((a, b) => a + b, 0) / t.length;
      expect(mean).toBeGreaterThan(65); expect(mean).toBeLessThan(80);
      expect(Math.max(...t)).toBeLessThanOrEqual(95); expect(Math.min(...t)).toBeGreaterThanOrEqual(34);
      const used = new Set<number>();
      for (const s of subs) for (const c of ux.rubrics[0].criteria as Crit[]) used.add([0, 1, 2, 3].find((i) => levelPoints(c.maxPoints, i) === s.criterionScores![c.id])!);
      expect([...used].sort()).toEqual([0, 1, 2, 3]);
      expect(subs.find((s) => s.studentId === "69070101")!.instructorScore).toBe(87);
    });
  });
}

test("Thai and English UX/UI files hold the same numbers, and the public and test-data copies are identical", () => {
  const th = rd("student-uxui-mockup.json"), en = rd("student-uxui-mockup-en.json");
  expect(en.submissions.map((s: Sub) => [s.id, s.instructorScore, s.criterionScores])).toEqual(th.submissions.map((s: Sub) => [s.id, s.instructorScore, s.criterionScores]));
  expect(en.courseStudents).toEqual(th.courseStudents);
  for (const n of ["student-uxui-mockup", "student-uxui-mockup-en", "student-flow-mockup", "student-flow-mockup-en", "student-history-mockup", "student-history-mockup-en"]) {
    expect(fs.readFileSync(`public/mock-data/${n}.json`, "utf8"), n).toBe(fs.readFileSync(`test-data/${n}.json`, "utf8"));
  }
});

// [16] from a browser that has never seen the UX/UI class, and again from one holding a stale roster for c-mock-4.
const doc = fs.readFileSync("test-data/seed-commands.txt", "utf8");
const cmd16 = doc.slice(doc.indexOf("\n[16] วิชา UX/UI"), doc.indexOf("\n[4] ล้างข้อมูลทั้งหมด")).split("\n").filter((l) => l.startsWith("fetch("));
const stored = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), key);

test("[16] documents a Thai and an English command", () => {
  expect(cmd16).toHaveLength(2);
  expect(cmd16[0]).toContain("student-uxui-mockup.json");
  expect(cmd16[1]).toContain("student-uxui-mockup-en.json");
});

for (const [i, label] of ["Thai", "English"].entries()) {
  test(`console command [16] (${label}) fills c-mock-4 with 30 students, the UX/UI Final Project, its rubric and results — and running it again changes nothing`, async ({ page }) => {
    const ux = rd(i ? "student-uxui-mockup-en.json" : "student-uxui-mockup.json");
    const hist = rd(i ? "student-history-mockup-en.json" : "student-history-mockup.json");
    await page.goto(`${BASE}/login`);
    await page.evaluate(([courses, roster, asg, subs]) => {
      localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
      localStorage.setItem("hwai_students_v1", JSON.stringify(roster));
      localStorage.setItem("hwai_assignments_v1", JSON.stringify(asg));
      localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
    }, [rd("courses-mockup.json"), hist.courseStudents, hist.assignments, hist.submissions] as const);
    for (let run = 0; run < 2; run++) {
      const reloaded = page.waitForEvent("load");
      await page.evaluate((c) => { (0, eval)(c); }, cmd16[i]);
      await reloaded;
      const roster = (await stored(page, "hwai_students_v1")) as { courseId: string; studentId: string }[];
      expect(roster.filter((r) => r.courseId === "c-mock-4")).toHaveLength(30);
      expect(roster.filter((r) => r.courseId !== "c-mock-4")).toHaveLength(hist.courseStudents.length - 2);   // the history's two c-mock-4 rows were replaced, nothing else touched
      const asg = (await stored(page, "hwai_assignments_v1")) as Asg[];
      expect(asg.filter((a) => a.id === "a-mock-10")).toHaveLength(1);
      expect(asg.filter((a) => a.id.startsWith("a-hist-"))).toHaveLength(hist.assignments.length);
      expect(((await stored(page, "hwai_rubrics_v1")) as Rubric[]).filter((r) => r.id === "r-mock-10")).toHaveLength(1);
      const subs = (await stored(page, "hwai_submissions_v1")) as Sub[];
      expect(subs.filter((s) => s.assignmentId === "a-mock-10")).toHaveLength(27);
      expect(subs.filter((s) => s.id.startsWith("sub-hist-"))).toHaveLength(hist.submissions.length);
      expect(new Set(subs.map((s) => s.id)).size).toBe(subs.length);
      expect(((await stored(page, "hwai_cohort_students_v1")) as unknown[]).length).toBe(rd(i ? "students-mockup-en.json" : "students-mockup.json").length);
    }
  });
}

test("what a student sees: 69070101 opens the UX/UI Final Project and the rubric card marks the level reached on every criterion", async ({ page }) => {
  const ux = rd("student-uxui-mockup-en.json");
  await page.goto(`${BASE}/login`);
  await page.evaluate(([courses, teachers, cohort, st, asg, rub, subs, cats]) => {
    localStorage.setItem("hwai_lang", "en");
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_managed_teachers_v1", JSON.stringify(teachers));
    localStorage.setItem("hwai_cohort_students_v1", JSON.stringify(cohort));
    localStorage.setItem("hwai_students_v1", JSON.stringify(st));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(asg));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(rub));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(subs));
    localStorage.setItem("hwai_grading_categories_v1", JSON.stringify(cats));
    localStorage.setItem("hwai_user", JSON.stringify({ name: "Somchai Jaidee", email: "69070101@kmitl.ac.th", role: "student", studentId: "69070101" }));
  }, [rd("courses-mockup-en.json"), rd("teachers-mockup-en.json"), rd("students-mockup-en.json"), ux.courseStudents, ux.assignments, ux.rubrics, ux.submissions, ux.gradingCategories] as const);
  await page.goto(`${BASE}/student/courses/c-mock-4/classwork/a-mock-10`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("C1 · Screen Completeness & Content Realism").first()).toBeVisible();
  await expect(page.getByText("15 / 15").first()).toBeVisible();   // C1: Excellent
  await expect(page.getByText("7 / 10").first()).toBeVisible();    // C3: Fair
  await expect(page.getByText("Your level")).toHaveCount(7);
});
