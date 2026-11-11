"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { achievedLevelIndex, type RubricCriterion } from "@/lib/assignments";
import { levelText, levelTone } from "@/lib/rubricLevels";

// The one level cell of the app (8/11/2569). A level is a neutral card: "Level 3 · 4 pts" in small type with a dot in the level's colour,
// the level's name in that colour, its description under it. Only a cell the reader should look at — the student's own level, the level
// being picked, the one the AI gave — gets the accent border and tint. DESIGN.md §9e.

type Level = RubricCriterion["levels"][number];

const cellBase = "rounded-xl border p-3 text-left";
const plain = "border-transparent bg-[var(--bg-app)]";
const marked = "border-[var(--accent)] bg-[var(--accent-subtle)]";

function LevelBody({ level, index, total, maxPoints, aside, tag }: { level: Level; index: number; total: number; maxPoints: number; aside?: ReactNode; tag?: ReactNode }) {
  const { t } = useLanguage();
  const tone = levelTone(index, total);
  return (
    <>
      <span className="flex items-center justify-between gap-2 text-xs tabular-nums text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
          {levelText(index, total, maxPoints, t)}
        </span>
        {aside}
      </span>
      <span className={`mt-1 flex items-center gap-2 text-xs font-bold ${tone.label}`}>
        {level.label}
        {tag}
      </span>
      {level.description ? (
        <span className="mt-1 block text-xs leading-relaxed text-[var(--text-primary)]">{level.description}</span>
      ) : null}
    </>
  );
}

/**
 * A criterion's levels, best first, to read. 4 levels sit 2 × 2 and go 4 across only when the card is wide (never 3 + 1); any other count
 * flows by width. `earned` marks the level that score falls in ("Your level"); `counts` adds how many students (teams) reached each level.
 */
export function RubricLevelGrid({ criterion, earned, counts, unit = "student" }: {
  criterion: Pick<RubricCriterion, "maxPoints" | "levels">;
  earned?: number;
  counts?: number[];
  unit?: "student" | "team";
}) {
  const { t } = useLanguage();
  const n = criterion.levels.length;
  if (n === 0) return null;
  const mine = earned === undefined ? null : achievedLevelIndex(earned, criterion.maxPoints, n);
  const columns = n === 4 ? "grid-cols-2 @3xl:grid-cols-4" : "";
  return (
    <div className="@container">
      <div className={`grid gap-2.5 ${columns}`} style={n === 4 ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {criterion.levels.map((level, i) => {
          const isMine = mine === i;
          const count = counts?.[i];
          return (
            <div key={i} aria-current={isMine ? "true" : undefined} className={`${cellBase} ${isMine ? marked : plain}`}>
              <LevelBody
                level={level} index={i} total={n} maxPoints={criterion.maxPoints}
                aside={count === undefined ? undefined : (
                  <span><span className="font-semibold text-[var(--text-primary)]">{count}</span> {unit === "team" ? t("ทีม", count === 1 ? "team" : "teams") : t("คน", count === 1 ? "student" : "students")}</span>
                )}
                tag={isMine ? <span className="rounded-full bg-[var(--accent-solid)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-solid-text)]">{t("ระดับของคุณ", "Your level")}</span> : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The same cells, one under the other, to pick one — for the narrow panels next to a piece of work (grading, Calibration). `aiLevel` tags
 * the level the AI gave. `value` is the picked level index, or null/undefined for none.
 */
export function RubricLevelPicker({ criterion, label, value, onPick, aiLevel, aiTestId }: {
  criterion: Pick<RubricCriterion, "maxPoints" | "levels">;
  /** accessible name of the group, already translated — e.g. "Level for Design" */
  label: string;
  value: number | null | undefined;
  onPick: (levelIndex: number) => void;
  aiLevel?: number | null;
  aiTestId?: string;
}) {
  const n = criterion.levels.length;
  return (
    <div role="radiogroup" aria-label={label} className={n === 0 ? "hidden" : "flex flex-col gap-1.5"}>
      {criterion.levels.map((level, i) => (
        <button
          key={i} type="button" role="radio" aria-checked={value === i}
          onClick={() => onPick(i)}
          className={`${cellBase} block w-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${value === i ? marked : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"}`}
        >
          <LevelBody
            level={level} index={i} total={n} maxPoints={criterion.maxPoints}
            tag={aiLevel === i ? <span data-testid={aiTestId} className="rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--s-info-text)]">AI</span> : undefined}
          />
        </button>
      ))}
    </div>
  );
}
