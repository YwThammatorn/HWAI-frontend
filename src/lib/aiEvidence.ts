// What the stand-in AI says about each criterion of a design submission, and where in the work it looked (10/11/2569).
// Advisor: the grading screen must show the AI's REASON and its EVIDENCE (R22; 3.3.3 step 5), not a canned sentence. Pure and deterministic
// (the same work and levels give the same words), no React — the mock-data script imports it too, so the demo class and a live regrade agree.
// Replace this one function with the real model's answer when the backend exists: the shape (reason + references into frames) is the contract.

import type { CriterionEvidence, EvidenceRef, RubricCriterion, WorkSnapshot } from "./assignments";

const hash = (str: string) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const frac = (seed: string) => (hash(seed) % 1000) / 1000;

const isThai = (s: string) => /[฀-๿]/.test(s);

type Crit = Pick<RubricCriterion, "id" | "name" | "levels">;

/** A box on a frame: where a criterion's evidence usually sits is not random, but for the demo it is spread out so the boxes differ. */
function boxFor(seed: string): NonNullable<EvidenceRef["box"]> {
  const w = 0.28 + 0.22 * frac(seed + ":w"), h = 0.12 + 0.18 * frac(seed + ":h");
  return { x: Math.round((0.04 + (0.92 - w) * frac(seed + ":x")) * 100) / 100, y: Math.round((0.06 + (0.88 - h) * frac(seed + ":y")) * 100) / 100, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
}

/**
 * The AI's reason and references for every criterion. `levels` = the level the AI chose per criterion (0 = best), as `mockAiGradeCriteria` or the
 * mock-data script produces them. A top level points at one place (what works); a lower level points at two (what to look at).
 */
export function aiEvidenceFor(seed: string, criteria: Crit[], levels: Record<string, number>, snapshot: WorkSnapshot): Record<string, CriterionEvidence> {
  const frames = snapshot.frames;
  const out: Record<string, CriterionEvidence> = {};
  if (frames.length === 0) return out;
  for (const c of criteria) {
    const n = Math.max(1, c.levels.length);
    const idx = Math.min(n - 1, Math.max(0, levels[c.id] ?? 0));
    const label = c.levels[idx]?.label ?? "";
    const first = frames[hash(seed + c.id) % frames.length];
    const second = frames.length > 1 ? frames[(frames.indexOf(first) + 1 + (hash(seed + c.id + "2") % (frames.length - 1))) % frames.length] : undefined;
    const top = idx === 0, bottom = idx >= n - 1 && n > 1;
    const th = isThai(c.name) || isThai(label);
    const reason = th
      ? top ? `ระดับ “${label}”: ที่ “${first.name}” ทำได้ครบตามคำอธิบายระดับนี้ ไม่พบจุดที่ต้องแก้ในส่วนที่ตรวจ`
        : bottom ? `ระดับ “${label}”: พบปัญหาที่ “${first.name}”${second ? ` และ “${second.name}”` : ""} ยังไม่ถึงคำอธิบายของระดับที่สูงกว่า ควรให้ผู้ตรวจดูจุดที่ทำเครื่องหมายไว้`
        : `ระดับ “${label}”: ที่ “${first.name}” ทำได้ส่วนใหญ่${second ? ` แต่ “${second.name}” ยังไม่สม่ำเสมอ` : ""} จึงยังไม่ถึงระดับที่สูงกว่า`
      : top ? `Level “${label}”: “${first.name}” meets the description of this level; nothing to fix in the part I checked.`
        : bottom ? `Level “${label}”: problems at “${first.name}”${second ? ` and “${second.name}”` : ""}; it does not reach the description of the level above. Please look at the marked places.`
        : `Level “${label}”: “${first.name}” does most of it${second ? `, but “${second.name}” is not consistent` : ""}, so it stays below the level above.`;
    const refs: EvidenceRef[] = [{ frameId: first.id, label: first.name, box: boxFor(seed + c.id + first.id) }];
    if (!top && second) refs.push({ frameId: second.id, label: second.name, box: boxFor(seed + c.id + second.id) });
    out[c.id] = { reason, refs };
  }
  return out;
}
