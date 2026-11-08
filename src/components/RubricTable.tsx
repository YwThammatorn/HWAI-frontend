"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { RubricCriterion } from "@/lib/assignments";
import { levelTone } from "@/lib/rubricLevels";
import CriterionName from "@/components/CriterionName";

export type RubricColumn = "levels" | "weight" | "points" | "earned";

/**
 * A rubric in a popup, one row per criterion (8/11/2569) — the compact form (DESIGN.md §9e). The columns say what that popup is about:
 * "levels" the level names with their colour dots, "weight" the criterion's share, "points" what it is worth, "earned" what a piece of work
 * got on it (`earned` holds the points per criterion id). `footer` is the last row: a label and the total.
 */
export default function RubricTable({ criteria, columns, earned, footer }: {
  criteria: RubricCriterion[];
  columns: RubricColumn[];
  earned?: Record<string, number>;
  footer?: { label: ReactNode; value: ReactNode };
}) {
  const { t } = useLanguage();
  const th = "px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider";
  const has = (c: RubricColumn) => columns.includes(c);
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[var(--bg-surface)]">
        <tr className="border-b border-[var(--border-subtle)] text-left">
          <th scope="col" className={th}>{t("เกณฑ์", "Criterion")}</th>
          {has("levels") && <th scope="col" className={th}>{t("ระดับ (ดี → ต้องปรับปรุง)", "Levels (best → worst)")}</th>}
          {has("weight") && <th scope="col" className={`${th} text-right`}>{t("น้ำหนัก", "Weight")}</th>}
          {has("points") && <th scope="col" className={`${th} text-right`}>{t("คะแนน", "Points")}</th>}
          {has("earned") && <th scope="col" className={`${th} text-right`}>{t("คะแนน", "Points")}</th>}
        </tr>
      </thead>
      <tbody>
        {criteria.map((c) => (
          <tr key={c.id} className="border-b border-[var(--border-subtle)] align-top last:border-b-0">
            <td className="px-3 py-2.5 text-[var(--text-primary)]"><CriterionName name={c.name} /></td>
            {has("levels") && (
              <td className="px-3 py-2.5">
                <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--text-secondary)]">
                  {c.levels.map((lv, i) => (
                    <li key={i} className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${levelTone(i, c.levels.length).dot}`} />
                      {lv.label}
                    </li>
                  ))}
                </ul>
              </td>
            )}
            {has("weight") && <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{c.weight}%</td>}
            {has("points") && <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-primary)]">{c.maxPoints}</td>}
            {has("earned") && <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[var(--text-primary)]">{earned?.[c.id] ?? 0} / {c.maxPoints}</td>}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="border-t border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm font-semibold text-[var(--text-primary)]">
            <td className="px-3 py-2.5" colSpan={columns.length}>{footer.label}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{footer.value}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
