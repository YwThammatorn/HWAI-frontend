import { test, expect } from "@playwright/test";
import fs from "fs";

const rd = (f: string) => JSON.parse(fs.readFileSync(`public/mock-data/${f}`, "utf8"));

// 4/10/2569 — the mock scores were "too much": every assignment out of 100 (no sense of how much each one weighs),
// the lab / quiz / final of every earlier course carrying one identical number, and a few extreme results.
// These guard the shape of the data (not the screens).

type Asg = { id: string; courseId: string; maxPoints: number; categoryId: string; name: string };
type Crit = { id: string; maxPoints: number; weight: number };
type Rubric = { assignmentId: string; criteria: Crit[] };
type Sub = { id: string; assignmentId: string; studentId: string; status: string; aiScore: number | null; instructorScore: number | null; criterionScores?: Record<string, number> };

for (const sfx of ["", "-en"]) {
  const label = sfx ? "English" : "Thai";
  const flow = rd(`student-flow-mockup${sfx}.json`);
  const hist = rd(`student-history-mockup${sfx}.json`);

  test.describe(`c-mock-1 scores (${label} files)`, () => {
    const asg = flow.assignments as Asg[];
    const subs = flow.submissions as Sub[];
    const by = (id: string) => asg.find((a) => a.id === id)!;

    test("assignments have different full marks, and the 'assignments' category adds up to 100 points", () => {
      const items = asg.filter((a) => a.categoryId === "gcat-seed-c1-1");   // the 40% "assignments" category
      expect(new Set(items.map((a) => a.maxPoints)).size).toBeGreaterThanOrEqual(3);   // 10, 15 and 25
      expect(items.reduce((n, a) => n + a.maxPoints, 0)).toBe(100);
      expect(by("a-mock-5").maxPoints).toBe(50);   // midterm
      expect(by("a-mock-9").maxPoints).toBe(100);  // final
    });

    test("nobody is perfect and nobody is near zero: every graded score sits between a third and 95% of the full mark", () => {
      for (const s of subs.filter((x) => x.status === "graded")) {
        const max = by(s.assignmentId).maxPoints;
        expect(s.instructorScore!, s.id).toBeLessThanOrEqual(Math.floor(max * 0.95));
        expect(s.instructorScore! / max, s.id).toBeGreaterThanOrEqual(1 / 3);
        expect(Number.isInteger(s.instructorScore), s.id).toBe(true);
      }
    });

    test("small quizzes are noisier than the big exam; each assignment keeps a sensible average (65–82%)", () => {
      const spread = (id: string) => {
        const p = subs.filter((s) => s.assignmentId === id && s.status === "graded").map((s) => (s.instructorScore! / by(id).maxPoints) * 100);
        const m = p.reduce((a, b) => a + b, 0) / p.length;
        return { m, sd: Math.sqrt(p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1)) };
      };
      for (const id of ["a-mock-1", "a-mock-2", "a-mock-4", "a-mock-5", "a-mock-6", "a-mock-8"]) {
        const { m } = spread(id);
        expect(m, id).toBeGreaterThan(65); expect(m, id).toBeLessThan(82);
      }
      expect(spread("a-mock-6").sd).toBeGreaterThan(spread("a-mock-1").sd);
    });

    test("rubrics follow the new full marks: criteria add up to the assignment, and each score splits exactly into its criteria", () => {
      const rubrics = flow.rubrics as Rubric[];
      for (const r of rubrics) expect(r.criteria.reduce((n, c) => n + c.maxPoints, 0), r.assignmentId).toBe(by(r.assignmentId).maxPoints);
      for (const s of subs.filter((x) => x.status === "graded" && x.criterionScores)) {
        const r = rubrics.find((x) => x.assignmentId === s.assignmentId)!;
        expect(r.criteria.reduce((n, c) => n + s.criterionScores![c.id], 0), s.id).toBe(s.instructorScore);
        for (const c of r.criteria) expect(s.criterionScores![c.id], `${s.id}/${c.id}`).toBeLessThanOrEqual(c.maxPoints);
      }
      for (const s of subs) if (s.aiScore !== null) expect(s.aiScore, s.id).toBeLessThanOrEqual(by(s.assignmentId).maxPoints);
    });
  });

  test.describe(`earlier courses (${label} files)`, () => {
    const asg = hist.assignments as Asg[];
    const subs = hist.submissions as Sub[];
    const piece = (a: Asg) => Number(a.id.slice(a.id.lastIndexOf("-") + 1));

    test("lab / quiz / final are out of 40 / 20 / 40 — points equal the weights, so the course adds up to 100", () => {
      for (const a of asg) expect(a.maxPoints, a.id).toBe({ 1: 40, 2: 20, 3: 40 }[piece(a)]);
      for (const r of hist.rubrics as Rubric[]) expect(r.criteria.reduce((n, c) => n + c.maxPoints, 0), r.assignmentId).toBe(asg.find((a) => a.id === r.assignmentId)!.maxPoints);
    });

    test("no student gets the same percentage on the lab, the quiz and the final; each piece stays inside 20–98%", () => {
      const groups = new Map<string, number[]>();
      for (const s of subs) {
        const a = asg.find((x) => x.id === s.assignmentId)!;
        const pct = (s.instructorScore! / a.maxPoints) * 100;
        expect(pct, s.id).toBeGreaterThanOrEqual(20); expect(pct, s.id).toBeLessThanOrEqual(98);
        const key = `${s.studentId}|${a.courseId}`;
        groups.set(key, [...(groups.get(key) ?? []), Math.round(pct)]);
      }
      expect(groups.size).toBeGreaterThanOrEqual(16);
      for (const [key, p] of groups) {
        expect(p).toHaveLength(3);
        expect(new Set(p).size, key).toBeGreaterThan(1);
      }
    });

    test("every graded score splits exactly into its rubric criteria", () => {
      for (const s of subs.filter((x) => x.status === "graded")) {
        const r = (hist.rubrics as Rubric[]).find((x) => x.assignmentId === s.assignmentId)!;
        expect(r.criteria.reduce((n, c) => n + s.criterionScores![c.id], 0), s.id).toBe(s.instructorScore);
        for (const c of r.criteria) expect(s.criterionScores![c.id], `${s.id}/${c.id}`).toBeLessThanOrEqual(c.maxPoints);
      }
    });
  });
}

test("Thai and English history mocks hold the same scores, and the public and test-data copies are identical", () => {
  expect(rd("student-history-mockup-en.json").submissions.map((s: Sub) => [s.id, s.instructorScore])).toEqual(rd("student-history-mockup.json").submissions.map((s: Sub) => [s.id, s.instructorScore]));
  for (const n of ["student-flow-mockup", "student-flow-mockup-en", "student-history-mockup", "student-history-mockup-en"]) {
    expect(fs.readFileSync(`public/mock-data/${n}.json`, "utf8"), n).toBe(fs.readFileSync(`test-data/${n}.json`, "utf8"));
  }
});

// The browser the teacher actually has: the OLD scores (everything out of 100, identical history numbers) already
// stored. The documented commands must replace them — [15] also for the rubrics — not sit beside them.
import type { Page } from "@playwright/test";
const BASE = "http://localhost:3000";
const doc = fs.readFileSync("test-data/seed-commands.txt", "utf8");
const block = (from: string, to: string) => doc.slice(doc.indexOf(from), doc.indexOf(to)).split("\n").filter((l) => l.startsWith("fetch("));
const cmd14 = block("\n[14] ประวัติ", "\n[15] ห้อง")[0];
const cmd15 = block("\n[15] ห้อง", "\n[4] ล้างข้อมูลทั้งหมด")[0];
const stored = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), key);

test("[14] from a browser holding the old history scores: every earlier course ends up with the new 40/20/40 marks and different scores, nothing doubled", async ({ page }) => {
  const hist = rd("student-history-mockup.json");
  const staleAsg = hist.assignments.map((a: Asg) => ({ ...a, maxPoints: 100 }));
  const staleSubs = hist.submissions.map((s: Sub) => ({ ...s, instructorScore: 91, criterionScores: undefined }));
  await page.goto(`${BASE}/login`);
  await page.evaluate(([a, s]) => {
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(a));
    localStorage.setItem("hwai_submissions_v1", JSON.stringify(s));
  }, [staleAsg, staleSubs] as const);
  const reloaded = page.waitForEvent("load");
  await page.evaluate((c) => { (0, eval)(c); }, cmd14);
  await reloaded;
  const asg = (await stored(page, "hwai_assignments_v1")) as Asg[];
  const subs = (await stored(page, "hwai_submissions_v1")) as Sub[];
  expect(asg.filter((a) => a.id.startsWith("a-hist-"))).toHaveLength(hist.assignments.length);
  expect(subs.filter((s) => s.id.startsWith("sub-hist-"))).toHaveLength(hist.submissions.length);
  expect(new Set(asg.map((a) => a.id)).size).toBe(asg.length);
  expect(new Set(subs.map((s) => s.id)).size).toBe(subs.length);
  expect(asg.filter((a) => a.id.startsWith("a-hist-")).map((a) => a.maxPoints).filter((m) => m === 100)).toHaveLength(0);
  const lab = subs.find((s) => s.id === "sub-hist-66010101-1-c-mock-38-1")!;
  expect(lab.instructorScore).toBe(hist.submissions.find((s: Sub) => s.id === lab.id).instructorScore);
  expect(lab.instructorScore).not.toBe(91);
});

test("[15] from a browser holding the old c-mock-1 data: assignments, rubrics and scores are all replaced together", async ({ page }) => {
  const flow = rd("student-flow-mockup.json");
  const staleAsg = flow.assignments.map((a: Asg) => ({ ...a, maxPoints: a.id === "a-mock-5" || a.id === "a-mock-9" ? a.maxPoints : 100 }));
  const staleRub = flow.rubrics.map((r: Rubric) => ({ ...r, criteria: r.criteria.map((c) => ({ ...c, maxPoints: c.weight })) }));   // old: criterion marks = weights, summing to 100
  await page.goto(`${BASE}/login`);
  await page.evaluate(([a, r, courses]) => {
    localStorage.setItem("hwai_courses_v2", JSON.stringify(courses));
    localStorage.setItem("hwai_assignments_v1", JSON.stringify(a));
    localStorage.setItem("hwai_rubrics_v1", JSON.stringify(r));
  }, [staleAsg, staleRub, rd("courses-mockup.json")] as const);
  const reloaded = page.waitForEvent("load");
  await page.evaluate((c) => { (0, eval)(c); }, cmd15);
  await reloaded;
  const asg = (await stored(page, "hwai_assignments_v1")) as Asg[];
  const rub = (await stored(page, "hwai_rubrics_v1")) as Rubric[];
  const subs = (await stored(page, "hwai_submissions_v1")) as Sub[];
  expect(Object.fromEntries(asg.filter((a) => a.id.startsWith("a-mock-")).map((a) => [a.id, a.maxPoints]))).toEqual({
    "a-mock-1": 15, "a-mock-2": 25, "a-mock-3": 15, "a-mock-4": 10, "a-mock-5": 50, "a-mock-6": 10, "a-mock-7": 10, "a-mock-8": 15, "a-mock-9": 100,
  });
  expect(rub).toHaveLength(flow.rubrics.length);
  for (const r of rub) expect(r.criteria.reduce((n, c) => n + c.maxPoints, 0), r.assignmentId).toBe(asg.find((a) => a.id === r.assignmentId)!.maxPoints);
  for (const s of subs.filter((x) => x.status === "graded" && x.criterionScores && x.id.startsWith("sub-mock-"))) {
    const r = rub.find((x) => x.assignmentId === s.assignmentId)!;
    expect(r.criteria.reduce((n, c) => n + s.criterionScores![c.id], 0), s.id).toBe(s.instructorScore);
  }
});
