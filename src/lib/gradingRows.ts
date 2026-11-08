import { latePenaltyOf, type Assignment, type Submission } from "./assignments";
import type { SubmissionRow } from "./groupSubmissions";
import { LOW_SCORE_PCT } from "./gradingInsights";
import { toneForPct, type ScoreTone } from "./scoreBook";

// What the Grading page's list and detail pane need to know about one row (a student, or a team on a group assignment) — computed in one place so
// the list, the detail and the "Grade next" button can never disagree (10/11/2569).

export interface RowFigures {
  /** the submission that stands for the row (the first one; a team's members share the grade) */
  rep: Submission;
  /** points taken off for late work under the assignment's late policy (0 = none) */
  penalty: number;
  /** the score that counts: the teacher's, else the AI's (hand-graded work has no AI score), minus the late deduction; null = nothing yet */
  score: number | null;
  /** the teacher's score differs from the AI's */
  edited: boolean;
  /** Score Book tone (green ≥ 80%, blue 60–79%, red < 60%) of `score`; null without a score */
  tone: ScoreTone | null;
  /** score ÷ maximum, 0–100 (not capped); null without a score */
  pct: number | null;
}

export function rowFigures(a: Pick<Assignment, "maxPoints" | "dueDate" | "latePolicy">, row: SubmissionRow, aiGraded: boolean): RowFigures {
  const rep = row.subs[0];
  const penalty = latePenaltyOf(a as Assignment, rep);
  const raw = aiGraded ? rep.instructorScore ?? rep.aiScore : rep.instructorScore;
  const score = raw !== null ? Math.max(0, raw - penalty) : null;
  const pct = score !== null && a.maxPoints > 0 ? (score / a.maxPoints) * 100 : null;
  return {
    rep,
    penalty,
    score,
    edited: aiGraded && rep.instructorScore !== null && rep.instructorScore !== rep.aiScore,
    tone: pct !== null ? toneForPct(pct) : null,
    pct,
  };
}

/** Attention first: AI unsure → not graded → graded but low → the rest. */
export function attentionRank(s: Submission, maxPoints: number, penalty: number): number {
  if (s.status === "need_review") return 0;
  if (s.status === "not_graded") return 1;
  const raw = s.instructorScore ?? s.aiScore;
  return raw !== null && maxPoints > 0 && (Math.max(0, raw - penalty) / maxPoints) * 100 < LOW_SCORE_PCT ? 2 : 3;
}

export type RowSort = "attention" | "name" | "score_desc" | "score_asc" | "submitted";
export const ROW_SORTS: RowSort[] = ["attention", "name", "score_desc", "score_asc", "submitted"];

const nameOf = (r: SubmissionRow) => (r.teamName ?? r.subs[0].studentName).toLowerCase();

/** The rows in the order the teacher asked for; ties keep the order they came in. */
export function sortRows(rows: SubmissionRow[], a: Assignment, aiGraded: boolean, sort: RowSort): SubmissionRow[] {
  const keyed = rows.map((row, i) => ({ row, i, f: rowFigures(a, row, aiGraded) }));
  const cmp: Record<RowSort, (x: (typeof keyed)[number], y: (typeof keyed)[number]) => number> = {
    attention: (x, y) => attentionRank(x.row.subs[0], a.maxPoints, x.f.penalty) - attentionRank(y.row.subs[0], a.maxPoints, y.f.penalty),
    name: (x, y) => nameOf(x.row).localeCompare(nameOf(y.row)),
    // no score yet goes last either way
    score_desc: (x, y) => (x.f.score === null ? 1 : 0) - (y.f.score === null ? 1 : 0) || (y.f.score ?? 0) - (x.f.score ?? 0),
    score_asc: (x, y) => (x.f.score === null ? 1 : 0) - (y.f.score === null ? 1 : 0) || (x.f.score ?? 0) - (y.f.score ?? 0),
    submitted: (x, y) => x.row.subs[0].submittedAt.localeCompare(y.row.subs[0].submittedAt),
  };
  return keyed.sort((x, y) => cmp[sort](x, y) || x.i - y.i).map((x) => x.row);
}

/** The next piece of work to open: the first row that is not graded yet, in attention order (AI-unsure ones first). */
export function nextToGrade(rows: SubmissionRow[], a: Assignment, aiGraded: boolean): { row: SubmissionRow | undefined; left: number } {
  const ordered = sortRows(rows, a, aiGraded, "attention");
  return { row: ordered.find((r) => r.subs[0].status !== "graded"), left: rows.filter((r) => r.subs[0].status !== "graded").length };
}
