"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { RubricCriterion } from "@/lib/assignments";
import { criterionWorth } from "@/lib/rubricLevels";
import type { CLO } from "@/lib/clo";
import CriterionName from "@/components/CriterionName";
import CloChips from "@/components/CloChips";
import { RubricLevelGrid } from "@/components/RubricLevels";

/**
 * What a criterion is worth, the one way (8/11/2569): "4 pts · 40%" while the rubric is only being read, "Earned 3 / 4" with its weight under it
 * once there is a score. Every rubric screen uses this instead of its own wording.
 */
export function CriterionPoints({ maxPoints, weight, earned, testId }: { maxPoints: number; weight: number; earned?: number; testId?: string }) {
  const { t } = useLanguage();
  if (earned === undefined) {
    return <span data-testid={testId} className="shrink-0 text-xs font-semibold tabular-nums text-[var(--accent)]">{criterionWorth(maxPoints, weight, t)}</span>;
  }
  return (
    <span data-testid={testId} className="shrink-0 text-right leading-tight tabular-nums">
      <span className="block text-sm font-bold text-[var(--text-primary)]">
        {t("ได้", "Earned")} {earned}<span className="font-semibold text-[var(--text-muted)]"> / {maxPoints}</span>
      </span>
      <span className="block text-xs text-[var(--text-muted)]">{weight}%</span>
    </span>
  );
}

/**
 * A criterion to read: its name (code badge, both languages) and CLO tags, what it is worth, its description, then its levels.
 * With `earned` (the student's own view of a scored criterion) it adds a progress bar and marks the level that score falls in.
 */
export default function RubricCriterionCard({ criterion, clos = [], earned }: { criterion: RubricCriterion; clos?: Pick<CLO, "id" | "code" | "text">[]; earned?: number }) {
  const { t } = useLanguage();
  const c = criterion;
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CriterionName name={c.name} />
          <CloChips cloIds={c.cloIds} clos={clos} />
        </div>
        <CriterionPoints maxPoints={c.maxPoints} weight={c.weight} earned={earned} />
      </div>
      {earned !== undefined && c.maxPoints > 0 && (
        <div
          role="progressbar"
          aria-label={t(`${c.name}: ได้ ${earned} จาก ${c.maxPoints}`, `${c.name}: ${earned} of ${c.maxPoints}`)}
          aria-valuemin={0}
          aria-valuemax={c.maxPoints}
          aria-valuenow={earned}
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
        >
          <div className="h-full rounded-full bg-[var(--accent-solid)]" style={{ width: `${Math.min(100, (earned / c.maxPoints) * 100)}%` }} />
        </div>
      )}
      {c.description && <p className="mb-2 text-xs text-[var(--text-muted)]">{c.description}</p>}
      <div className="mt-2"><RubricLevelGrid criterion={c} earned={earned} /></div>
    </div>
  );
}
