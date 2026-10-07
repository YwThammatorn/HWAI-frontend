"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { achievedLevelIndex, type Rubric, type Submission } from "@/lib/assignments";
import { toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";

// How a level looks on a distribution bar: best → worst. warn is not used — it means "awaiting grading" everywhere else.
const FILL = ["bg-[var(--s-ok-text)]", "bg-[var(--s-info-text)]", "bg-[var(--text-muted)]", "bg-[var(--s-err-text)]"];
const TEXT = ["text-[var(--s-ok-text)]", "text-[var(--s-info-text)]", "text-[var(--text-secondary)]", "text-[var(--s-err-text)]"];
const BOX = [
  "border-[var(--s-ok-bd)] bg-[var(--s-ok-bg)]",
  "border-[var(--s-info-bd)] bg-[var(--s-info-bg)]",
  "border-[var(--border)] bg-[var(--bg-app)]",
  "border-[var(--s-err-bd)] bg-[var(--s-err-bg)]",
];
/** position on the scale → one of the four looks (3 levels: green / grey / red; 4: green / blue / grey / red) */
const toneOf = (i: number, n: number) => (n <= 1 ? 0 : Math.round((i / (n - 1)) * 3));

/**
 * The teacher's view of the assignment's rubric on the grading screen: every criterion with its points, how the
 * graded work so far is spread across its levels (a segmented bar + counts) and its class average; each row opens to
 * the wording of every level with the number of students who reached it. So the rubric sits next to the grading
 * instead of behind the Edit page, and shows where the class is strong or weak at a glance.
 */
export default function GradingRubricPanel({ rubric, graded, editHref, unit = "student" }: {
  rubric: Rubric;
  /** the graded work to count (one per student, or one per team) */
  graded: Submission[];
  editHref: string;
  /** what one counted item is — a group assignment counts teams */
  unit?: "student" | "team";
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const criteria = rubric.criteria;
  const totalPoints = criteria.reduce((n, c) => n + c.maxPoints, 0);
  const withScores = graded.filter((s) => s.criterionScores);
  const toggle = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allOpen = criteria.length > 0 && criteria.every((c) => open.has(c.id));

  const rows = criteria.map((c) => {
    const n = c.levels.length;
    const counts = new Array(Math.max(n, 1)).fill(0) as number[];
    let sum = 0, scored = 0;
    for (const s of withScores) {
      const v = s.criterionScores![c.id];
      if (typeof v !== "number") continue;
      sum += v; scored++;
      const li = achievedLevelIndex(v, c.maxPoints, n);
      if (li !== null) counts[li]++;
    }
    return { c, counts, scored, avg: scored > 0 ? sum / scored : null };
  });

  const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

  return (
    <section className={`${card} mt-6`} aria-labelledby="grading-rubric-h" data-testid="grading-rubric">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 id="grading-rubric-h" className="text-base font-bold text-[var(--text-primary)]">{t("เกณฑ์การให้คะแนน", "Grading rubric")}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {t(`${criteria.length} เกณฑ์ · รวม ${totalPoints} คะแนน`, `${criteria.length} criteria · ${totalPoints} points`)}
            {" · "}
            {withScores.length > 0
              ? t(`นับจากงานที่ตรวจแล้ว ${withScores.length}${graded.length > withScores.length ? ` จาก ${graded.length}` : ""} ชิ้น`, `from ${withScores.length}${graded.length > withScores.length ? ` of ${graded.length}` : ""} graded ${withScores.length === 1 ? "item" : "items"}`)
              : t("ยังไม่มีงานที่ตรวจแล้ว", "nothing graded yet")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(criteria.map((c) => c.id)))}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {allOpen ? t("ซ่อนคำอธิบายระดับทั้งหมด", "Hide all level descriptions") : t("แสดงคำอธิบายระดับทั้งหมด", "Show all level descriptions")}
          </button>
          <Link
            href={editHref}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {t("แก้ไขเกณฑ์", "Edit rubric")}
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
        {rows.map(({ c, counts, scored, avg }) => {
          const isOpen = open.has(c.id);
          const n = c.levels.length;
          const avgPct = avg !== null && c.maxPoints > 0 ? (avg / c.maxPoints) * 100 : null;
          return (
            <li key={c.id} data-testid={`rubric-row-${c.id}`}>
              <div className="grid items-center gap-x-5 gap-y-2 px-5 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_264px_32px]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                  {c.description && <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{c.description}</p>}
                </div>

                <div className="min-w-0">
                  {scored > 0 ? (
                    <>
                      <div
                        role="img"
                        aria-label={c.levels.map((lv, i) => `${lv.label}: ${counts[i]}`).join(", ")}
                        className="flex h-3 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                      >
                        {counts.map((k, i) => k > 0 && <div key={i} className={`${FILL[toneOf(i, n)]} hwai-bar-grow`} style={{ width: `${(k / scored) * 100}%` }} />)}
                      </div>
                      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums" aria-hidden="true">
                        {c.levels.map((lv, i) => (
                          <li key={i} className={`inline-flex items-center gap-1 ${counts[i] > 0 ? TEXT[toneOf(i, n)] : "text-[var(--text-muted)]"}`}>
                            <span className={`h-2 w-2 rounded-full ${FILL[toneOf(i, n)]} ${counts[i] > 0 ? "" : "opacity-40"}`} />
                            {lv.label} <span className="font-semibold">{counts[i]}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีคะแนนรายเกณฑ์ให้สรุป", "No per-criterion scores to summarise yet")}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:justify-end">
                  <span className="inline-flex h-7 items-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-2 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                    {c.maxPoints} {t("คะแนน", "pts")}
                  </span>
                  {avgPct !== null && avg !== null ? (
                    <span
                      className={`inline-flex h-7 items-center whitespace-nowrap rounded-lg px-2 text-xs font-semibold tabular-nums ${SCORE_TONE_CLASSES[toneForPct(avgPct)]}`}
                      title={t("คะแนนเฉลี่ยของเกณฑ์นี้", "Class average on this criterion")}
                    >
                      {t("เฉลี่ย", "Avg")} {Number.isInteger(avg) ? avg : avg.toFixed(1)} · {Math.round(avgPct)}%
                    </span>
                  ) : (
                    <span className="inline-flex h-7 items-center px-2 text-xs text-[var(--text-muted)]">—</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-expanded={isOpen}
                  aria-label={t(`คำอธิบายระดับของ ${c.name}`, `Level descriptions for ${c.name}`)}
                  title={t("คำอธิบายระดับ", "Level descriptions")}
                  className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {isOpen && (
                <div className="grid gap-2 px-5 pb-4 sm:grid-cols-2 xl:grid-cols-4" style={n > 4 ? { gridTemplateColumns: `repeat(${Math.min(n, 6)}, minmax(0, 1fr))` } : undefined}>
                  {c.levels.map((lv, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${BOX[toneOf(i, n)]}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${TEXT[toneOf(i, n)]}`}>{lv.label}</p>
                        <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{counts[i]}</span> {unit === "team" ? t("ทีม", counts[i] === 1 ? "team" : "teams") : t("คน", counts[i] === 1 ? "student" : "students")}
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-primary)]">{lv.description || <span className="text-[var(--text-muted)]">{t("ไม่มีคำอธิบาย", "No description")}</span>}</p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
