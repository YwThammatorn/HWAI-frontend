import type { Assignment } from "./assignments";
import type { GradingCategory } from "./gradingCategories";
import { statsFromScores, type ExamStats } from "./examStats";
import type { ScoreBook, ScoreBookRow } from "./scoreBook";

// The teacher's class summary, derived from the same ScoreBook the matrix is drawn from — so the two
// views of one section can never disagree. Pure functions (no React) so every number can be checked.

export const LETTERS = ["A", "B", "C", "D", "F"] as const;
export type Letter = (typeof LETTERS)[number];

/**
 * Where an assignment stands for the teacher:
 *  announced — Finish & announce was pressed, students see their scores
 *  ready     — nothing left to grade, only the announcement is missing
 *  grading   — some work graded, some still waiting
 *  none      — nothing graded yet
 */
export type AssignmentState = "announced" | "ready" | "grading" | "none";

export interface AssignmentSummary {
  assignment: Assignment;
  /** Min / max / mean / SD of the graded scores (raw points); null when nothing is graded. */
  stats: ExamStats | null;
  graded: number;
  pending: number;
  missing: number;
  students: number;
  state: AssignmentState;
}

export interface CategorySummary {
  key: string;
  category: GradingCategory | null;
  /** Mean of each student's own percentage in this category; null when nobody has a score in it yet. */
  avgPct: number | null;
  assignments: AssignmentSummary[];
}

export interface AttentionRow {
  row: ScoreBookRow;
  /** Running grade is under 60%. */
  lowGrade: boolean;
  missing: number;
}

export interface ScoreSummary {
  /** Spread of every student's running grade (0–100) — null until anyone has a graded score. */
  overall: ExamStats | null;
  gradeCounts: Record<Letter, number>;
  /** Students with no graded work yet (no letter). */
  ungraded: number;
  categories: CategorySummary[];
  attention: AttentionRow[];
}

export function buildScoreSummary(book: ScoreBook): ScoreSummary {
  const gradeCounts: Record<Letter, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let ungraded = 0;
  for (const r of book.rows) {
    if (r.letter && r.letter in gradeCounts) gradeCounts[r.letter as Letter]++;
    else ungraded++;
  }

  const overall = statsFromScores(book.rows.map((r) => r.normalized).filter((v): v is number => v !== null));

  const categories: CategorySummary[] = book.groups.map((g) => {
    const pcts = g.category
      ? book.rows.map((r) => r.categoryPct[g.category!.id]).filter((v): v is number => v !== null && v !== undefined)
      : [];
    return {
      key: g.key,
      category: g.category,
      avgPct: pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
      assignments: g.columns.map((a) => summariseAssignment(book, a)),
    };
  });

  const attention: AttentionRow[] = book.rows
    .map((row) => ({
      row,
      lowGrade: row.normalized !== null && row.normalized < 60,
      missing: Object.values(row.cells).filter((c) => c.kind === "missing").length,
    }))
    .filter((x) => x.lowGrade || x.missing > 0)
    .sort((a, b) =>
      Number(b.lowGrade) - Number(a.lowGrade) ||
      b.missing - a.missing ||
      (a.row.normalized ?? 101) - (b.row.normalized ?? 101));

  return { overall, gradeCounts, ungraded, categories, attention };
}

function summariseAssignment(book: ScoreBook, assignment: Assignment): AssignmentSummary {
  const scores: number[] = [];
  let pending = 0, missing = 0;
  for (const r of book.rows) {
    const c = r.cells[assignment.id];
    if (c.kind === "graded") scores.push(c.score);
    else if (c.kind === "pending") pending++;
    else if (c.kind === "missing") missing++;
  }
  const state: AssignmentState = assignment.gradingFinalized
    ? "announced"
    : scores.length > 0 && pending === 0
      ? "ready"
      : scores.length > 0 || pending > 0
        ? "grading"
        : "none";
  return { assignment, stats: statsFromScores(scores), graded: scores.length, pending, missing, students: book.rows.length, state };
}
