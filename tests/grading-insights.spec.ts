import { test, expect } from "@playwright/test";
import { assignmentInsights, attentionOf, LOW_SCORE_PCT } from "../src/lib/gradingInsights";
import type { Assignment } from "../src/lib/assignments";

// 10/11/2569 — what the teacher sees about one assignment while grading it: the spread of the scores, who needs a second look,
// and the criteria people lost the most points on. Pure function, so the course Grading card and the assignment's Grading page
// can never disagree.

const A = { maxPoints: 100, dueDate: "2026-10-01" } as Assignment;
const sub = (o: Partial<Parameters<typeof attentionOf>[1]> = {}) => ({
  submittedAt: "2026-09-30T10:00:00", instructorScore: null, aiScore: null, status: "not_graded" as const, late: false, criterionScores: undefined, ...o,
});

test.describe("attentionOf — the four signals", () => {
  test("the AI was not sure → needs review (even before a score exists)", () => {
    expect(attentionOf(A, sub({ status: "need_review", aiScore: 70 }))).toEqual(["need_review"]);
  });
  test(`graded under ${LOW_SCORE_PCT}% of the maximum → low; exactly ${LOW_SCORE_PCT}% is not`, () => {
    expect(attentionOf(A, sub({ status: "graded", instructorScore: 59 }))).toEqual(["low"]);
    expect(attentionOf(A, sub({ status: "graded", instructorScore: 60 }))).toEqual([]);
  });
  test("a score that is not graded yet is never 'low'", () => {
    expect(attentionOf(A, sub({ status: "not_graded", aiScore: 10 }))).toEqual([]);
  });
  test("the teacher's score differs from the AI's → edited; equal or missing is not", () => {
    expect(attentionOf(A, sub({ status: "graded", aiScore: 80, instructorScore: 85 }))).toEqual(["edited"]);
    expect(attentionOf(A, sub({ status: "graded", aiScore: 80, instructorScore: 80 }))).toEqual([]);
    expect(attentionOf(A, sub({ status: "graded", aiScore: null, instructorScore: 85 }))).toEqual([]);
  });
  test("late work is flagged, and signals add up on one submission", () => {
    expect(attentionOf(A, sub({ late: true }))).toEqual(["late"]);
    expect(attentionOf(A, sub({ status: "graded", aiScore: 40, instructorScore: 45, late: true }))).toEqual(["low", "edited", "late"]);
  });
});

test.describe("assignmentInsights", () => {
  const rubric = {
    criteria: [
      { id: "c1", name: "Layout", maxPoints: 50 },
      { id: "c2", name: "Usability", maxPoints: 50 },
      { id: "c3", name: "Unscored", maxPoints: 10 },
    ],
  } as never;

  test("counts the signals, keeps only graded scores, and averages them", () => {
    const r = assignmentInsights(A, [
      sub({ status: "graded", instructorScore: 90 }),
      sub({ status: "graded", instructorScore: 50, aiScore: 70 }),     // low + edited
      sub({ status: "need_review", aiScore: 75 }),
      sub({ status: "not_graded", late: true }),
    ]);
    expect(r.scores.sort()).toEqual([50, 90]);
    expect(r.mean).toBe(70);
    expect(r.attention).toEqual({ need_review: 1, low: 1, edited: 1, late: 1 });
  });

  test("weak criteria: lowest average first, a criterion nobody was scored on is left out", () => {
    const r = assignmentInsights(A, [
      sub({ status: "graded", instructorScore: 80, criterionScores: { c1: 45, c2: 20 } }),
      sub({ status: "graded", instructorScore: 70, criterionScores: { c1: 35, c2: 30 } }),
      sub({ status: "need_review", aiScore: 60, criterionScores: { c1: 0, c2: 0 } }),      // not graded yet: not counted
    ], rubric);
    expect(r.weakCriteria.map((c) => c.name)).toEqual(["Usability", "Layout"]);
    expect(r.weakCriteria[0].avgPct).toBeCloseTo(50);       // (20+30)/2 of 50
    expect(r.weakCriteria[1].avgPct).toBeCloseTo(80);       // (45+35)/2 of 50
  });

  test("nothing graded → no scores, no mean, no weak criteria (the page says 'no scores yet')", () => {
    const r = assignmentInsights(A, [sub(), sub({ status: "need_review", aiScore: 10 })], rubric);
    expect(r.scores).toEqual([]);
    expect(r.mean).toBeNull();
    expect(r.weakCriteria).toEqual([]);
  });
});
