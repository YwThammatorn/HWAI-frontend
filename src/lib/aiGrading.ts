// Stand-in for the AI grader (11/10/2569). The AI is not wired to a backend yet, so "send to the AI" is simulated here:
// a deterministic score per submission (the same input always gives the same result, so a demo and a test can rely on it)
// and a status — a score the AI is less sure about (< 65 % of the maximum) comes back as "need_review" for the teacher.
// Replace this one function with the real call when the backend exists; nothing else knows how the score is produced.

import type { Submission } from "./assignments";

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
