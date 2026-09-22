import type { Assignment, Submission } from "./assignments";
import { computeCategoryGradeRows, computeTotalSoFar, type GradingCategory } from "./gradingCategories";

// Score Book: one matrix of students × assignments for a course, grouped by grading category.
// Pure functions only (no React) so the numbers can be checked without rendering. The weighted
// total reuses the same math as the student's Evaluation page, so both screens always agree.

export function gradeLetter(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

/** Colour band for a graded score. `warn` is reserved for "awaiting grading", so it never appears here. */
export type ScoreTone = "ok" | "info" | "err";
export function toneForPct(pct: number): ScoreTone {
  if (pct >= 80) return "ok";
  if (pct >= 60) return "info";
  return "err";
}

// Shared chip/legend classes for every screen that renders a ScoreCell (teacher Score Book, student
// Evaluation). Single source of truth for the DESIGN.md §6/§9b pattern (pale `-bg` fill + the matching
// `-bd` border, never a wildcard token string — see HANDOFF.md for why that matters) so the two screens
// can never drift apart, and a future colour fix only has to happen in one place.
export const SCORE_TONE_CLASSES: Record<ScoreTone, string> = {
  ok: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border border-[var(--s-ok-bd)]",
  info: "bg-[var(--s-info-bg)] text-[var(--s-info-text)] border border-[var(--s-info-bd)]",
  err: "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border border-[var(--s-err-bd)]",
};
export const PENDING_CHIP_CLASSES = "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] border border-[var(--s-warn-bd)]";
export const MISSING_CHIP_CLASSES = "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border border-[var(--s-err-bd)]";

export type ScoreCell =
  | { kind: "graded"; score: number; max: number; pct: number; submissionId: string }
  | { kind: "pending"; submissionId: string }   // handed in, not graded yet (needs review / not graded)
  | { kind: "missing" }                          // due date passed and nothing was handed in
  | { kind: "none" };                            // nothing handed in yet, still open

export interface ScoreBookStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
}

/** Assignments sharing a grading category; `category` is null for the "no category" group. */
export interface ScoreBookGroup {
  key: string;
  category: GradingCategory | null;
  columns: Assignment[];
}

export interface ScoreBookRow {
  student: ScoreBookStudent;
  cells: Record<string, ScoreCell>;               // keyed by assignment id
  categoryPct: Record<string, number | null>;    // keyed by category id
  /** Weighted contribution so far (0–100) — the same "Total so far" the student sees. null = nothing graded yet. */
  total: number | null;
  /** Combined weight of the categories that already have graded work (what `total` is out of). */
  gradedWeight: number;
  /** total / gradedWeight × 100 — the running grade so far. */
  normalized: number | null;
  letter: string | null;
}

export interface ScoreBook {
  groups: ScoreBookGroup[];
  rows: ScoreBookRow[];
  /** Average % of the graded cells per assignment (null when none graded). */
  columnAverages: Record<string, number | null>;
  classAverage: number | null;
  gradedCells: number;
  pendingCells: number;
  missingCells: number;
  totalCells: number;
}

export function buildScoreBook(input: {
  students: ScoreBookStudent[];
  assignments: Assignment[];
  categories: GradingCategory[];
  submissions: Submission[];
  /** YYYY-MM-DD — anything due before this and not handed in counts as missing. */
  today: string;
}): ScoreBook {
  const { students, assignments, categories, submissions, today } = input;
  const byAssignment = assignments.map((a) => a.id);

  // Columns: one group per category (in the order given), then "no category". Inside a group, by due date.
  const byDue = (a: Assignment, b: Assignment) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name);
  const groups: ScoreBookGroup[] = categories
    .map((category) => ({ key: category.id, category, columns: assignments.filter((a) => a.categoryId === category.id).sort(byDue) }))
    .filter((g) => g.columns.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const loose = assignments.filter((a) => !a.categoryId || !known.has(a.categoryId)).sort(byDue);
  if (loose.length > 0) groups.push({ key: "none", category: null, columns: loose });

  const subOf = new Map<string, Submission>();
  for (const s of submissions) {
    const k = `${s.assignmentId}::${s.studentId}`;
    if (!subOf.has(k)) subOf.set(k, s);
  }

  let gradedCells = 0, pendingCells = 0, missingCells = 0;
  const pctSums: Record<string, { sum: number; n: number }> = Object.fromEntries(byAssignment.map((id) => [id, { sum: 0, n: 0 }]));

  const rows: ScoreBookRow[] = students.map((student) => {
    const cells: Record<string, ScoreCell> = {};
    for (const a of assignments) {
      const sub = subOf.get(`${a.id}::${student.studentId}`);
      if (!sub) {
        if (a.dueDate < today) { cells[a.id] = { kind: "missing" }; missingCells++; } else cells[a.id] = { kind: "none" };
      } else if (sub.status === "graded") {
        const score = sub.instructorScore ?? sub.aiScore ?? 0;
        const pct = a.maxPoints > 0 ? (score / a.maxPoints) * 100 : 0;
        cells[a.id] = { kind: "graded", score, max: a.maxPoints, pct, submissionId: sub.id };
        gradedCells++;
        pctSums[a.id].sum += pct;
        pctSums[a.id].n += 1;
      } else {
        cells[a.id] = { kind: "pending", submissionId: sub.id };
        pendingCells++;
      }
    }

    const gradeRows = computeCategoryGradeRows(categories, assignments, submissions, student.studentId);
    const categoryPct: Record<string, number | null> = {};
    for (const r of gradeRows) categoryPct[r.category.id] = r.percent;
    const gradedWeight = gradeRows.filter((r) => r.percent !== null).reduce((sum, r) => sum + r.category.weight, 0);
    const total = gradedWeight > 0 ? computeTotalSoFar(gradeRows) : null;
    const normalized = total !== null && gradedWeight > 0 ? (total / gradedWeight) * 100 : null;
    return {
      student, cells, categoryPct, total, gradedWeight, normalized,
      letter: normalized !== null ? gradeLetter(normalized, 100) : null,
    };
  });

  const columnAverages: Record<string, number | null> = {};
  for (const id of byAssignment) columnAverages[id] = pctSums[id].n > 0 ? pctSums[id].sum / pctSums[id].n : null;
  const running = rows.map((r) => r.normalized).filter((v): v is number => v !== null);
  const classAverage = running.length > 0 ? running.reduce((a, b) => a + b, 0) / running.length : null;

  return {
    groups, rows, columnAverages, classAverage,
    gradedCells, pendingCells, missingCells,
    totalCells: students.length * assignments.length,
  };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text (with a UTF-8 BOM so Thai opens correctly in Excel). Column order follows the on-screen groups. */
export function scoreBookToCsv(
  book: ScoreBook,
  labels: { id: string; title: string; first: string; last: string; total: string; grade: string; pending: string; missing: string; categoryPct: (name: string) => string },
): string {
  const columns = book.groups.flatMap((g) => g.columns);
  const cats = book.groups.filter((g) => g.category).map((g) => g.category!);
  const header = [
    labels.id, labels.title, labels.first, labels.last,
    ...columns.map((a) => `${a.name} (/${a.maxPoints})`),
    ...cats.map((c) => labels.categoryPct(`${c.name} ${c.weight}%`)),
    labels.total, labels.grade,
  ];
  const lines = book.rows.map((r) => {
    const cells = columns.map((a) => {
      const c = r.cells[a.id];
      return c.kind === "graded" ? c.score : c.kind === "pending" ? labels.pending : c.kind === "missing" ? labels.missing : "";
    });
    const catCells = cats.map((c) => (r.categoryPct[c.id] === null || r.categoryPct[c.id] === undefined ? "" : (r.categoryPct[c.id] as number).toFixed(1)));
    return [
      r.student.studentId, r.student.title ?? "", r.student.firstName, r.student.lastName,
      ...cells, ...catCells,
      r.total === null ? "" : r.total.toFixed(1), r.letter ?? "",
    ];
  });
  return "﻿" + [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
