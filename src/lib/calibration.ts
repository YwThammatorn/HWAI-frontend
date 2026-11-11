"use client";

import { createContext, useContext } from "react";
import type { Assignment, Rubric, RubricCriterion, Submission } from "./assignments";
import { achievedLevelIndex } from "./assignments";
import { mockAiGradeCriteria } from "./aiGrading";
import { groupSubmissionsByTeam } from "./groupSubmissions";
import type { StudentGroup } from "./studentGroups";

// Calibration (12/10/2569): the teacher scores a few sample submissions by hand, blind to the AI; the same work is then put through the
// AI and the two are compared criterion by criterion. Levels are positions on the criterion's scale, 0 = best.

export interface CalibrationRun {
  id: string;
  assignmentId: string;
  createdAt: string;
  /** one work item per entry — a submission id, or a team's key for a group assignment */
  sampleIds: string[];
  /** the teacher's level per criterion for each sample: sample id → criterion id → level (0 = best) */
  teacherLevels: Record<string, Record<string, number>>;
  /** every sample scored on every criterion */
  completedAt?: string;
  /** the blind-test switch: on = the AI's levels stay hidden while the teacher scores. Off by default (13/10), so a run without the field is "not blind" — only
   *  runs finished before that day were always blind, and they carry no `sawAi` either. */
  blind?: boolean;
  /** at least one criterion was scored while the AI's level was on screen — the comparison is then not blind */
  sawAi?: boolean;
}

export interface CalibrationContextValue {
  runs: CalibrationRun[];
  /** create or replace a run (matched by id) */
  saveRun: (run: CalibrationRun) => void;
  removeRun: (id: string) => void;
}
export const CalibrationContext = createContext<CalibrationContextValue | null>(null);
export function useCalibrations(): CalibrationContextValue {
  const ctx = useContext(CalibrationContext);
  if (!ctx) throw new Error("useCalibrations must be used within CalibrationProvider");
  return ctx;
}

/** One piece of work to grade: a submission, or a whole team. */
export interface WorkUnit { key: string; name: string; subs: Submission[] }

/** The work of an assignment as units — one per submission, or one per team for a group assignment — leaving out withdrawn students. */
export function workUnitsOf(a: Assignment, submissions: Submission[], groups: StudentGroup[], withdrawn: Set<string>, teamLabel: string): WorkUnit[] {
  const subs = submissions.filter((s) => s.assignmentId === a.id && !withdrawn.has(s.studentId));
  if (a.submissionType === "group") return groupSubmissionsByTeam(subs, groups, teamLabel).map((r) => ({ key: r.key, name: r.teamName ?? r.subs[0].studentName, subs: r.subs }));
  return subs.map((s) => ({ key: s.id, name: s.studentName, subs: [s] }));
}

/** What the AI actually gave one unit (14/10/2569): the levels it put on each criterion and the total it gave. Calibration compares the
 *  teacher with THIS, not with a fresh simulation. */
export interface StoredAi { levels: Record<string, number>; score: number }

/**
 * The AI's stored result for a unit, or null when the AI has not graded it. Per-criterion marks are read as they were saved
 * (`aiCriterionScores`); work the AI only scored as a whole (older data) gets its share of the total on each criterion, the same
 * split the Grade screen starts from.
 */
export function storedAiFor(unit: WorkUnit, rubric: Pick<Rubric, "criteria">): StoredAi | null {
  const sub = unit.subs.find((s) => s.aiScore !== null);
  if (!sub || sub.aiScore === null) return null;
  const maxTotal = rubric.criteria.reduce((n, c) => n + c.maxPoints, 0);
  const levels: Record<string, number> = {};
  for (const c of rubric.criteria) {
    const pts = sub.aiCriterionScores?.[c.id] ?? (maxTotal > 0 ? (sub.aiScore * c.maxPoints) / maxTotal : 0);
    levels[c.id] = achievedLevelIndex(pts, c.maxPoints, c.levels.length) ?? 0;
  }
  return { levels, score: sub.aiScore };
}

/** The units the AI has graded — the only ones Calibration can compare the teacher with. */
export const aiGradedUnits = (units: WorkUnit[], rubric: Pick<Rubric, "criteria">) => units.filter((u) => storedAiFor(u, rubric) !== null);

/** The AI's levels for a unit: its stored result; for a unit it has not graded, what the stand-in would give. */
export function aiLevelsFor(unit: WorkUnit, rubric: Pick<Rubric, "criteria">): StoredAi {
  return storedAiFor(unit, rubric) ?? (() => { const r = mockAiGradeCriteria(unit.key, rubric.criteria); return { levels: r.levels, score: r.score }; })();
}

/**
 * `n` units spread over the AI's own ranking — top, middle and bottom — so the teacher's scores show where the AI drifts across
 * the whole range, not just on the work that is easy to judge. Always includes the best and the worst of the AI's ranking.
 * `skip` = keys to leave out (used by "swap").
 */
export function pickSample(units: WorkUnit[], rubric: Pick<Rubric, "criteria">, n: number, skip: string[] = []): WorkUnit[] {
  const pool = units.filter((u) => !skip.includes(u.key))
    .map((u) => ({ u, score: aiLevelsFor(u, rubric).score }))
    .sort((a, b) => b.score - a.score || a.u.key.localeCompare(b.u.key));
  if (pool.length <= n) return pool.map((p) => p.u);
  const chosen = new Set<number>();
  for (let k = 0; k < n; k++) chosen.add(Math.round((k * (pool.length - 1)) / Math.max(1, n - 1)));
  // two ranks can round onto the same unit: fill from the nearest free ones
  for (let d = 0; chosen.size < n; d++) for (const idx of [...chosen].flatMap((i) => [i - d, i + d])) if (idx >= 0 && idx < pool.length && chosen.size < n) chosen.add(idx);
  return [...chosen].sort((a, b) => a - b).map((i) => pool[i].u);
}

export interface CriterionComparison {
  criterionId: string;
  n: number;
  /** mean of (teacher level − AI level): + = the AI is more generous than the teacher (it puts the work at a better, lower level) */
  bias: number;
  /** mean absolute difference in levels */
  meanAbs: number;
  /** what is left of the difference once the steady lean is taken out (shifted by the nearest whole level): a steady
   *  "the AI is one level too generous" leaves 0; scattered disagreement stays — only clearer level wording helps that */
  residual: number;
  /** share of samples where both chose the same level, 0..1 — the measure the verdict is built on (10/11/2569) */
  agreement: number;
  /** how many samples that is, and the share where the two are at most ONE level apart */
  exact: number;
  within1: number;
  teacherMean: number;
  aiMean: number;
  /** from `agreement` alone (see ALIGNED_AT / MOSTLY_AT): the mean difference used to say "aligned" at 40 % exact agreement */
  verdict: "aligned" | "mostly" | "off";
  /** which way the AI leans, kept apart from the verdict: + = generous, − = strict; null when the mean difference is under half a level */
  lean: "lenient" | "strict" | null;
}

/** Exact agreement at or above this is "aligned"; at or above MOSTLY_AT "mostly aligned"; below it the level wording is not doing its job yet. */
export const ALIGNED_AT = 0.8;
export const MOSTLY_AT = 0.6;
/** Fewer pairs than this and a kappa (or any share) is a trend, not a measurement — the screen says so. */
export const MIN_PAIRS_FOR_A_MEASURE = 20;

/** Teacher vs AI on every criterion of the run. Samples missing a teacher level for a criterion are left out of that criterion. */
export function compare(run: CalibrationRun, units: WorkUnit[], rubric: Pick<Rubric, "criteria">): CriterionComparison[] {
  return rubric.criteria.map((c) => {
    const diffs: number[] = [], t: number[] = [], a: number[] = [];
    for (const key of run.sampleIds) {
      const unit = units.find((u) => u.key === key);
      const tl = run.teacherLevels[key]?.[c.id];
      if (!unit || tl === undefined) continue;
      const ai = aiLevelsFor(unit, rubric);
      const al = ai.levels[c.id];
      diffs.push(tl - al); t.push(tl); a.push(al);
    }
    const n = diffs.length;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
    const bias = mean(diffs), meanAbs = mean(diffs.map(Math.abs));
    const shift = Math.round(bias);
    const residual = mean(diffs.map((d) => Math.abs(d - shift)));
    return {
      criterionId: c.id, n, bias, meanAbs, residual,
      agreement: n ? diffs.filter((d) => d === 0).length / n : 0,
      exact: diffs.filter((d) => d === 0).length,
      within1: n ? diffs.filter((d) => Math.abs(d) <= 1).length / n : 0,
      teacherMean: mean(t), aiMean: mean(a),
      verdict: n === 0 ? "off" : diffs.filter((d) => d === 0).length / n >= ALIGNED_AT ? "aligned" : diffs.filter((d) => d === 0).length / n >= MOSTLY_AT ? "mostly" : "off",
      lean: bias >= 0.5 ? "lenient" : bias <= -0.5 ? "strict" : null,
    };
  });
}

export interface OverallAgreement {
  /** teacher/AI pairs over every criterion of every sample */
  pairs: number;
  exact: number;
  within1: number;
  /** quadratic-weighted Cohen's kappa over all the pairs (a one-level miss costs little, a three-level miss a lot); null when it is undefined (everything on one level) */
  kappa: number | null;
  /** Landis & Koch's bands */
  kappaBand: "poor" | "slight" | "fair" | "moderate" | "substantial" | "almost-perfect" | null;
  /** under MIN_PAIRS_FOR_A_MEASURE: read it as a trend */
  fewPairs: boolean;
}

export function kappaBandOf(k: number): NonNullable<OverallAgreement["kappaBand"]> {
  return k < 0 ? "poor" : k <= 0.2 ? "slight" : k <= 0.4 ? "fair" : k <= 0.6 ? "moderate" : k <= 0.8 ? "substantial" : "almost-perfect";
}

/** Pooled agreement of one run: exact, within one level, and weighted kappa (levels are ordered, so the weights are quadratic). */
export function overallAgreement(run: CalibrationRun, units: WorkUnit[], rubric: Pick<Rubric, "criteria">): OverallAgreement {
  const pairs: [number, number][] = [];
  for (const c of rubric.criteria) {
    for (const key of run.sampleIds) {
      const unit = units.find((u) => u.key === key);
      const tl = run.teacherLevels[key]?.[c.id];
      if (!unit || tl === undefined) continue;
      pairs.push([tl, aiLevelsFor(unit, rubric).levels[c.id]]);
    }
  }
  const n = pairs.length;
  const K = Math.max(2, ...rubric.criteria.map((c) => c.levels.length));
  const exact = pairs.filter(([a, b]) => a === b).length;
  const within1 = pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length;
  let kappa: number | null = null;
  if (n > 0) {
    const w = (i: number, j: number) => ((i - j) / (K - 1)) ** 2;           // disagreement weight
    const rowT = new Array(K).fill(0), rowA = new Array(K).fill(0);
    for (const [a, b] of pairs) { rowT[Math.min(a, K - 1)]++; rowA[Math.min(b, K - 1)]++; }
    const observed = pairs.reduce((sum, [a, b]) => sum + w(Math.min(a, K - 1), Math.min(b, K - 1)), 0) / n;
    let expected = 0;
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) expected += w(i, j) * (rowT[i] / n) * (rowA[j] / n);
    kappa = expected === 0 ? null : 1 - observed / expected;                 // expected 0 = both always on the same single level: undefined
  }
  return { pairs: n, exact, within1, kappa, kappaBand: kappa === null ? null : kappaBandOf(kappa), fewPairs: n < MIN_PAIRS_FOR_A_MEASURE };
}

export type RubricSuggestionKind = "ceiling" | "floor" | "disagree" | "heavy-flat";
export interface RubricSuggestion { kind: RubricSuggestionKind; criterionId: string; value: number }

/**
 * Changes to the rubric itself that the results point to. `graded` = the assignment's graded work; each carries per-criterion points
 * from the teacher (criterionScores) or the AI (aiCriterionScores).
 *   ceiling    — at least 80 % of the work sits on the top level: the criterion does not separate anyone (value = share)
 *   floor      — nobody reaches the top level: it may be out of reach or worded too tightly (value = number of work items)
 *   disagree   — teacher and AI still differ by a level or more on average even once their steady lean is taken out: the level wording is not clear enough (value = the remaining mean difference)
 *   heavy-flat — worth half of the points or more yet almost everyone is on the same level (value = share on the commonest level)
 */
export function suggestRubricChanges(rubric: Pick<Rubric, "criteria">, graded: Submission[], cmp: CriterionComparison[]): RubricSuggestion[] {
  const out: RubricSuggestion[] = [];
  const total = rubric.criteria.reduce((n, c) => n + c.maxPoints, 0);
  for (const c of rubric.criteria as RubricCriterion[]) {
    const levels = graded
      .map((s) => s.criterionScores?.[c.id] ?? s.aiCriterionScores?.[c.id])
      .filter((v): v is number => typeof v === "number")
      .map((v) => achievedLevelIndex(v, c.maxPoints, c.levels.length))
      .filter((v): v is number => v !== null);
    if (levels.length >= 5) {
      const top = levels.filter((l) => l === 0).length / levels.length;
      if (top >= 0.8) out.push({ kind: "ceiling", criterionId: c.id, value: top });
      else if (top === 0) out.push({ kind: "floor", criterionId: c.id, value: levels.length });
      const counts = new Map<number, number>();
      levels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
      const common = Math.max(...counts.values()) / levels.length;
      if (total > 0 && c.maxPoints / total >= 0.5 && common >= 0.8 && top < 0.8) out.push({ kind: "heavy-flat", criterionId: c.id, value: common });
    }
    const k = cmp.find((x) => x.criterionId === c.id);
    if (k && k.n >= 3 && k.residual >= 1) out.push({ kind: "disagree", criterionId: c.id, value: k.residual });
  }
  return out;
}
