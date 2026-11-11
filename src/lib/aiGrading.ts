// Stand-in for the AI grader (11/10/2569). The AI is not wired to a backend yet, so "send to the AI" is simulated here:
// a deterministic score per submission (the same input always gives the same result, so a demo and a test can rely on it)
// and a status — a score the AI is less sure about (< 65 % of the maximum) comes back as "need_review" for the teacher.
// Replace this one function with the real call when the backend exists; nothing else knows how the score is produced.

import { levelShare, type Submission, type RubricCriterion, type WorkSnapshot, type CriterionEvidence } from "./assignments";
import { aiEvidenceFor } from "./aiEvidence";
import { criterionKey } from "./rubricHistory";
import { splitCriterionName } from "./rubricName";

const hash = (str: string) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export interface AiResult { score: number; status: Extract<Submission["status"], "graded" | "need_review"> }

/** `seed` = anything stable for the work being graded (a submission id, or a team id so every member gets the same). */
export function mockAiGrade(seed: string, maxPoints: number): AiResult {
  const r = (hash(seed) % 1000) / 1000;              // 0 … 0.999
  const pct = 0.5 + 0.45 * r;                         // 50 – 95 %
  return { score: Math.round(maxPoints * pct), status: pct < 0.65 ? "need_review" : "graded" };
}

/** What the teacher has not yet sent to the AI: submissions still waiting to be graded. */
export const waitingForAi = (s: Pick<Submission, "status">) => s.status === "not_graded";

// ── per-criterion AI (12/10/2569) ───────────────────────────────────────────────────────────────────────────────────────────

/** The stand-in AI's habit on one criterion, in levels: + = it is more generous than a careful teacher, − = stricter. Derived from the
 *  criterion's name so every criterion has a habit of its own and the same rubric always behaves the same — this is what Calibration finds. */
export function aiLeniency(criterionName: string): number {
  return [0.9, 0.3, 1.3, -0.5, 0.6][hash("lenient:" + criterionKey(criterionName)) % 5];
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** Points for a level position (0 = best) on a criterion — the rubric file's level scale (100 / 66.67 / 33.33 / 0 % with four levels). */
export const levelPointsOf = (c: Pick<RubricCriterion, "maxPoints" | "levels">, levelIndex: number) => Math.round(c.maxPoints * levelShare(levelIndex, c.levels.length));

export interface AiCriteriaResult { levels: Record<string, number>; criterionScores: Record<string, number>; reasons: Record<string, string>; score: number; status: AiResult["status"] }

/** The AI's reason for its mark on one criterion (7/11/2569: the real AI must explain every criterion it scores). A stand-in sentence
 *  from the share of the criterion's points it gave; the real call returns its own text in the same place. */
export function mockAiReason(criterionName: string, share: number): string {
  const name = splitCriterionName(criterionName).main.toLowerCase();
  if (share >= 0.7) return `Good demonstration of ${name}. The work clearly meets expectations and shows solid understanding of the required concepts.`;
  return `Minor issues found in ${name}. Consider revising the final section for clarity and accuracy.`;
}

/**
 * The AI scoring one piece of work against a rubric, criterion by criterion. `seed` makes it repeatable. The work has a quality of its
 * own (the seed), a little different on every criterion; the AI sees it through its habit on that criterion (aiLeniency).
 * (There used to be a saved per-criterion correction on top of that — "AI offset", removed 10/11/2569.)
 */
export function mockAiGradeCriteria(seed: string, criteria: Pick<RubricCriterion, "id" | "name" | "maxPoints" | "levels">[]): AiCriteriaResult {
  const quality = 0.25 + 0.7 * ((hash(seed) % 1000) / 1000);                    // 0.25 … 0.95
  const levels: Record<string, number> = {}, criterionScores: Record<string, number> = {}, reasons: Record<string, string> = {};
  let score = 0, max = 0;
  for (const c of criteria) {
    const n = Math.max(1, c.levels.length);
    const q = Math.min(1, Math.max(0, quality + (((hash(seed + c.id) % 100) / 100) - 0.5) * 0.35));
    const truePos = (1 - q) * (n - 1);                                         // where a careful grader would put it (0 = best level)
    const idx = clampInt(truePos - aiLeniency(c.name), 0, n - 1);
    levels[c.id] = idx;
    criterionScores[c.id] = levelPointsOf(c, idx);
    reasons[c.id] = mockAiReason(c.name, c.maxPoints > 0 ? criterionScores[c.id] / c.maxPoints : 0);
    score += criterionScores[c.id];
    max += c.maxPoints;
  }
  return { levels, criterionScores, reasons, score, status: max > 0 && score / max < 0.65 ? "need_review" : "graded" };
}

// ── one place that writes the AI's marks (14/10/2569) ───────────────────────────────────────────────────────────────────────

/** The AI's evidence for its marks: on a design with frozen frames, the reason plus where it looked (`aiEvidenceFor`); otherwise the reason
 *  alone, with no references (10/11/2569 — one field, `aiEvidence`, for both). */
export function aiEvidenceOf(seed: string, criteria: Pick<RubricCriterion, "id" | "name" | "maxPoints" | "levels">[], crit: AiCriteriaResult, snapshot?: WorkSnapshot): Record<string, CriterionEvidence> {
  if (snapshot && snapshot.frames.length > 0) return aiEvidenceFor(seed, criteria, crit.levels, snapshot);
  return Object.fromEntries(criteria.map((c) => [c.id, { reason: crit.reasons[c.id] ?? "", refs: [] }]));
}

/** The fields that change on a submission when the AI (re)grades it: the AI's marks with its reason per criterion, and everything the
 *  teacher had put on top of an earlier AI result cleared. Used by "Grade with AI", the per-row Re-grade and Calibration's re-grade. */
export function aiGradingUpdate(seed: string, maxPoints: number, rubric?: { criteria: Pick<RubricCriterion, "id" | "name" | "maxPoints" | "levels">[] }, snapshot?: WorkSnapshot):
  Pick<Submission, "aiScore" | "aiCriterionScores" | "aiEvidence" | "instructorScore" | "status" | "criterionScores" | "criterionComments"> {
  const withRubric = !!rubric && rubric.criteria.length > 0;
  const crit = withRubric ? mockAiGradeCriteria(seed, rubric!.criteria) : undefined;
  const res = crit ?? { ...mockAiGrade(seed, maxPoints), criterionScores: undefined };
  return {
    aiScore: res.score,
    aiCriterionScores: res.criterionScores,
    // a reason on every criterion (the AI must always say why, 7/11/2569); where it looked only when there is a frozen copy of the design to
    // point into (an earlier result's evidence never survives a regrade)
    aiEvidence: crit ? aiEvidenceOf(seed, rubric!.criteria, crit, snapshot) : undefined,
    instructorScore: null,
    status: res.status,
    criterionScores: undefined,
    criterionComments: undefined,
  };
}
