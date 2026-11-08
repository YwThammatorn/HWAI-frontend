// One place for how a rubric level is coloured and worded (8/11/2569). Every screen that shows a rubric — the read cards, the level picker, the
// compact table and the editor — takes its level colour and its "Level 3 · 4 pts" text from here, so a level looks the same everywhere.

import { levelShare } from "./assignments";
import { levelRatio } from "./rubricTemplates";

type Translate = (th: string, en: string) => string;

// Green → red ramp. A level's colour comes from its position in the scale, so 3 levels still read green / amber / red and 4–6 fill in
// lime and orange. These are the only colours a level has (DESIGN.md §9e): the dot and the level name; the card itself stays neutral.
const LEVEL_TONES = [
  { label: "text-[var(--level-1)]", dot: "bg-[var(--level-1)]" },
  { label: "text-[var(--level-2)]", dot: "bg-[var(--level-2)]" },
  { label: "text-[var(--level-3)]", dot: "bg-[var(--level-3)]" },
  { label: "text-[var(--level-4)]", dot: "bg-[var(--level-4)]" },
  { label: "text-[var(--level-5)]", dot: "bg-[var(--level-5)]" },
];

/** Colour classes of level `i` (0 = best) on a scale of `total` levels. */
export function levelTone(i: number, total: number) {
  return LEVEL_TONES[Math.round(levelRatio(i, total) * (LEVEL_TONES.length - 1))];
}

/** Points a level is worth on a criterion worth `maxPoints`. */
export const levelPoints = (maxPoints: number, i: number, total: number) => Math.round(maxPoints * levelShare(i, total));

/** "Level 3 · 4 pts" — the best level is the highest number, as in the rubric file. */
export const levelText = (i: number, total: number, maxPoints: number, t: Translate) =>
  t(`ระดับ ${total - 1 - i} · ${levelPoints(maxPoints, i, total)} คะแนน`, `Level ${total - 1 - i} · ${levelPoints(maxPoints, i, total)} pts`);

/** "4 pts · 40%" — what a criterion is worth, while a rubric is only being read or edited (nothing scored yet). */
export const criterionWorth = (maxPoints: number, weight: number, t: Translate) => t(`${maxPoints} คะแนน · ${weight}%`, `${maxPoints} pts · ${weight}%`);
