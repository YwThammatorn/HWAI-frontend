import { finalScoreOf, type Assignment, type Rubric, type Submission } from "./assignments";

// What the teacher needs to see about one assignment while grading it (10/11/2569): how the scores spread, who needs a second look, and
// which criteria people lost the most points on. One pure function so the course Grading card and the assignment's Grading page read the
// same numbers and can never disagree. Pass ONE submission per student (per team for a group assignment), withdrawn students left out.

/** A score under this share of the maximum is "low" — the same line the Score Book's red tone and the Class summary's "needs attention" use. */
export const LOW_SCORE_PCT = 60;

export type AttentionKey = "need_review" | "low" | "edited" | "late";
export const ATTENTION_KEYS: AttentionKey[] = ["need_review", "low", "edited", "late"];

export interface WeakCriterion {
  criterionId: string;
  name: string;
  /** mean points earned ÷ the criterion's maximum, 0–100 */
  avgPct: number;
}

export interface AssignmentInsights {
  /** the counted score of every graded submission (late deduction applied) */
  scores: number[];
  mean: number | null;
  attention: Record<AttentionKey, number>;
  /** criteria with at least one scored submission, lowest average first */
  weakCriteria: WeakCriterion[];
}

type Counted = Pick<Submission, "submittedAt" | "instructorScore" | "aiScore" | "status" | "late" | "criterionScores">;

/** Which of the four signals this one submission raises. */
export function attentionOf(a: Pick<Assignment, "maxPoints" | "dueDate" | "latePolicy">, s: Counted): AttentionKey[] {
  const out: AttentionKey[] = [];
  if (s.status === "need_review") out.push("need_review");
  if (s.status === "graded" && a.maxPoints > 0) {
    const final = finalScoreOf(a as Assignment, s);
    if (final !== null && (final / a.maxPoints) * 100 < LOW_SCORE_PCT) out.push("low");
  }
  if (s.instructorScore !== null && s.aiScore !== null && s.instructorScore !== s.aiScore) out.push("edited");
  if (s.late) out.push("late");
  return out;
}

export function assignmentInsights(a: Assignment, subs: Counted[], rubric?: Pick<Rubric, "criteria">): AssignmentInsights {
  const attention: Record<AttentionKey, number> = { need_review: 0, low: 0, edited: 0, late: 0 };
  const scores: number[] = [];
  for (const s of subs) {
    for (const k of attentionOf(a, s)) attention[k]++;
    if (s.status === "graded") {
      const v = finalScoreOf(a, s);
      if (v !== null) scores.push(v);
    }
  }

  const weakCriteria: WeakCriterion[] = [];
  for (const c of rubric?.criteria ?? []) {
    if (c.maxPoints <= 0) continue;
    const earned = subs
      .filter((s) => s.status === "graded")
      .map((s) => s.criterionScores?.[c.id])
      .filter((v): v is number => typeof v === "number");
    if (earned.length === 0) continue;
    weakCriteria.push({ criterionId: c.id, name: c.name, avgPct: (earned.reduce((x, y) => x + y, 0) / earned.length / c.maxPoints) * 100 });
  }
  weakCriteria.sort((x, y) => x.avgPct - y.avgPct);

  return { scores, mean: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null, attention, weakCriteria };
}
