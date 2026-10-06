import type { Assignment, Submission } from "./assignments";

export interface ExamStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  /** Sample standard deviation (n − 1, like a spreadsheet's STDEV); null with fewer than two scores. */
  sd: number | null;
  /** Every graded score, highest first (so a student can see how many classmates scored lower). */
  scores: number[];
}

/**
 * Class-wide numbers for one exam. Only exists once the teacher has announced the results
 * (gradingFinalized) — before that a student must not see anyone's score, aggregate or not.
 */
export function computeExamStats(assignment: Assignment | undefined, submissions: Submission[]): ExamStats | null {
  if (!assignment?.isExam || !assignment.gradingFinalized) return null;
  return statsFromScores(
    submissions
      .filter((s) => s.assignmentId === assignment.id && s.status === "graded")
      .map((s) => s.instructorScore ?? s.aiScore ?? 0),
  );
}

/** The same min / max / mean / SD from a plain list of scores — the teacher's summary has no "announced" gate. */
export function statsFromScores(scores: number[]): ExamStats | null {
  if (scores.length === 0) return null;
  const count = scores.length;
  const mean = scores.reduce((sum, v) => sum + v, 0) / count;
  const sd = count > 1 ? Math.sqrt(scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (count - 1)) : null;
  return { count, min: Math.min(...scores), max: Math.max(...scores), mean, sd, scores: [...scores].sort((a, b) => b - a) };
}

/** Share of classmates (not counting you) who scored strictly lower, 0–100; null when you are the only score. */
export function percentBetterThan(stats: ExamStats, myScore: number): number | null {
  if (stats.count < 2) return null;
  const below = stats.scores.filter((v) => v < myScore).length;
  return Math.round((below / (stats.count - 1)) * 100);
}
