import { test, expect } from "@playwright/test";
import { percentBetterThan, computeExamStats } from "../src/lib/examStats";

const stats = (scores: number[]) => ({ count: scores.length, min: Math.min(...scores), max: Math.max(...scores), mean: 0, sd: 1, scores: [...scores].sort((a, b) => b - a) });

test.describe("percentBetterThan — share of classmates strictly below you", () => {
  test("top of the class is better than everyone else, the lowest than no one", () => {
    expect(percentBetterThan(stats([10, 20, 30, 40]), 40)).toBe(100);
    expect(percentBetterThan(stats([10, 20, 30, 40]), 10)).toBe(0);
  });
  test("middle: 2 of the 3 others are lower", () => {
    expect(percentBetterThan(stats([10, 20, 30, 40]), 30)).toBe(67);
  });
  test("ties are not 'better than' — a score shared with everyone beats no one", () => {
    expect(percentBetterThan(stats([30, 30, 30, 30]), 30)).toBe(0);
    expect(percentBetterThan(stats([20, 30, 30, 40]), 30)).toBe(33);   // only the 20 is below
  });
  test("a lone score has no classmates to compare with", () => {
    expect(percentBetterThan(stats([30]), 30)).toBeNull();
  });
});

test("computeExamStats keeps every score, highest first, and still needs announced results", () => {
  const a = { id: "x", isExam: true, gradingFinalized: true } as never;
  const sub = (studentId: string, v: number) => ({ assignmentId: "x", studentId, status: "graded", instructorScore: v, aiScore: null }) as never;
  const s = computeExamStats(a, [sub("1", 30), sub("2", 41), sub("3", 25)])!;
  expect(s.scores).toEqual([41, 30, 25]);
  expect(computeExamStats({ id: "x", isExam: true, gradingFinalized: false } as never, [sub("1", 30)])).toBeNull();
});
