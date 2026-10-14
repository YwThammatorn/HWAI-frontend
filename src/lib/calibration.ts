"use client";

import { createContext, useContext } from "react";
import type { Rubric, RubricCriterion, Submission } from "./assignments";
import { achievedLevelIndex } from "./assignments";
import { mockAiGradeCriteria } from "./aiGrading";

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
  /** "Use these values" was pressed: the offsets that were saved on the rubric */
  appliedAt?: string;
  appliedOffsets?: Record<string, number>;
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

/** What the AI would give each unit right now (with the correction already saved on the rubric), criterion → level. */
export function aiLevelsFor(unit: WorkUnit, rubric: Pick<Rubric, "criteria" | "aiOffsets">) {
  return mockAiGradeCriteria(unit.key, rubric.criteria, rubric.aiOffsets);
}

/**
 * `n` units spread over the AI's own ranking — top, middle and bottom — so the teacher's scores show where the AI drifts across
 * the whole range, not just on the work that is easy to judge. Always includes the best and the worst of the AI's ranking.
 * `skip` = keys to leave out (used by "swap").
 */
export function pickSample(units: WorkUnit[], rubric: Pick<Rubric, "criteria" | "aiOffsets">, n: number, skip: string[] = []): WorkUnit[] {
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
  /** what is left of the difference once the AI's strictness is shifted by the suggested whole-level correction: a steady
   *  "the AI is one level too generous" leaves 0; scattered disagreement stays — and no strictness setting can fix that */
  residual: number;
  /** share of samples where both chose the same level, 0..1 */
  agreement: number;
  teacherMean: number;
  aiMean: number;
  verdict: "lenient" | "strict" | "aligned" | "inconsistent";
}

/** Teacher vs AI on every criterion of the run. Samples missing a teacher level for a criterion are left out of that criterion. */
export function compare(run: CalibrationRun, units: WorkUnit[], rubric: Pick<Rubric, "criteria" | "aiOffsets">): CriterionComparison[] {
  return rubric.criteria.map((c) => {
    const diffs: number[] = [], t: number[] = [], a: number[] = [];
    for (const key of run.sampleIds) {
      const unit = units.find((u) => u.key === key);
      const tl = run.teacherLevels[key]?.[c.id];
      if (!unit || tl === undefined) continue;
      const al = aiLevelsFor(unit, rubric).levels[c.id];
      diffs.push(tl - al); t.push(tl); a.push(al);
    }
    const n = diffs.length;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
    const bias = mean(diffs), meanAbs = mean(diffs.map(Math.abs));
    const shift = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Math.round(bias)));
    const residual = mean(diffs.map((d) => Math.abs(d - shift)));
    return {
      criterionId: c.id, n, bias, meanAbs, residual,
      agreement: n ? diffs.filter((d) => d === 0).length / n : 0,
      teacherMean: mean(t), aiMean: mean(a),
      verdict: bias >= 0.5 ? "lenient" : bias <= -0.5 ? "strict" : meanAbs >= 1 ? "inconsistent" : "aligned",
    };
  });
}

export const MAX_OFFSET = 2;
/** The correction the comparison suggests: what is saved now plus how far off the AI was, never more than ±2 levels. */
export function suggestOffsets(cmp: CriterionComparison[], current: Record<string, number> = {}): Record<string, number> {
  return Object.fromEntries(cmp.map((c) => [c.criterionId, Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, (current[c.criterionId] ?? 0) + Math.round(c.bias)))]));
}

export type RubricSuggestionKind = "ceiling" | "floor" | "disagree" | "heavy-flat";
export interface RubricSuggestion { kind: RubricSuggestionKind; criterionId: string; value: number }

/**
 * Changes to the rubric itself that the results point to. `graded` = the assignment's graded work; each carries per-criterion points
 * from the teacher (criterionScores) or the AI (aiCriterionScores).
 *   ceiling    — at least 80 % of the work sits on the top level: the criterion does not separate anyone (value = share)
 *   floor      — nobody reaches the top level: it may be out of reach or worded too tightly (value = number of work items)
 *   disagree   — teacher and AI still differ by a level or more on average AFTER the AI's strictness is corrected (a steady lean is the strictness setting's job, not the wording's): the level wording is not clear enough (value = the remaining mean difference)
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
