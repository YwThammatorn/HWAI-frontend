"use client";

import { useLanguage } from "@/context/LanguageContext";
import { binIndexOf, histogramBins } from "@/lib/scoreHistogram";

const one = (n: number) => n.toFixed(1);
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
/** space above a bar reserved for its count (and the "You" tag on the student's own bar) */
const HEAD = 46;

/**
 * Bar chart of how the class scored: ten ranges, one bar each, with the number of students on top of the bar.
 * The student's own range is the dark bar tagged "You", so they can see where they stand and how many others
 * are around them; the dashed line is the class average. Counts only — no one else's score is shown.
 */
export default function ScoreHistogram({ scores, maxPoints, myScore, mean, unit = "" }: {
  scores: number[];
  maxPoints: number;
  myScore: number | null;
  mean: number;
  /** appended to the range labels when the scale isn't raw points, e.g. "%" */
  unit?: string;
}) {
  const { t } = useLanguage();
  const bins = histogramBins(scores, maxPoints);
  const top = Math.max(...bins.map((b) => b.count), 1);
  const mine = myScore === null ? -1 : binIndexOf(myScore, maxPoints);
  const meanAt = maxPoints > 0 ? Math.min(100, Math.max(0, (mean / maxPoints) * 100)) : 0;
  const range = (i: number) => `${num(bins[i].lo)}–${num(bins[i].hi)}${unit}`;
  const people = (n: number) => t(`${n} คน`, `${n} ${n === 1 ? "student" : "students"}`);

  const summary = t(
    `กราฟแท่งการกระจายคะแนนของนักศึกษา ${scores.length} คน เฉลี่ย ${one(mean)}` + (mine >= 0 ? ` คุณอยู่ช่วง ${range(mine)} มี ${people(bins[mine].count)}` : ""),
    `Bar chart of how ${scores.length} student${scores.length === 1 ? "" : "s"} scored, average ${one(mean)}` + (mine >= 0 ? `; you are in ${range(mine)} with ${people(bins[mine].count)}` : "")
  );

  return (
    <figure className="m-0" data-testid="score-histogram">
      <div role="group" aria-label={summary}>
        <div className="relative">
        <ol className="flex h-48 items-stretch gap-1 border-b border-[var(--border-subtle)] @2xl:h-56 @2xl:gap-2">
          {bins.map((b, i) => {
            const isMine = i === mine;
            return (
              <li
                key={i}
                title={`${range(i)}: ${people(b.count)}`}
                data-testid="hist-bar"
                data-bin={i}
                data-count={b.count}
                data-mine={isMine ? "true" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
              >
                <span className="sr-only">{`${range(i)}: ${people(b.count)}${isMine ? ", " + t("ช่วงของคุณ", "your range") : ""}`}</span>
                {isMine && (
                  <span aria-hidden="true" className="mb-0.5 rounded-full bg-[var(--accent-solid)] px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--accent-solid-text)] @2xl:text-xs">{t("คุณ", "You")}</span>
                )}
                <span aria-hidden="true" className={`relative z-20 mb-0.5 rounded bg-[var(--bg-surface)]/85 px-0.5 text-xs tabular-nums @2xl:text-sm ${isMine ? "font-bold text-[var(--text-primary)]" : b.count === 0 ? "text-[var(--text-muted)]" : "font-semibold text-[var(--text-secondary)]"}`}>{b.count}</span>
                <div
                  aria-hidden="true"
                  className={`hwai-hist-grow w-full rounded-t-md ${isMine ? "bg-[var(--accent-solid)]" : "bg-[var(--accent-bright)]/50"}`}
                  style={{ height: `max(3px, calc((100% - ${HEAD}px) * ${b.count / top}))`, animationDelay: `${i * 35}ms` }}
                />
              </li>
            );
          })}
        </ol>

        {/* class average — drawn over the bars only, not through the axis labels below them */}
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-[var(--text-secondary)]/70" style={{ left: `${meanAt}%` }}>
          <span className={`absolute top-0 whitespace-nowrap rounded bg-[var(--bg-surface)]/90 px-1 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)] @2xl:text-xs ${meanAt > 70 ? "right-1" : "left-1"}`}>{t("เฉลี่ย", "Avg")} {one(mean)}{unit}</span>
        </div>
        </div>

        <div aria-hidden="true" className="mt-1.5 flex gap-1 @2xl:gap-2">
          {bins.map((b, i) => (
            <span key={i} className={`min-w-0 flex-1 text-center text-[10px] tabular-nums @2xl:text-xs ${i === mine ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              <span className="@2xl:hidden">{num(b.lo)}</span>
              <span className="hidden @2xl:inline">{range(i)}</span>
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] @2xl:text-sm">
        {mine >= 0 && (
          <span data-testid="hist-you" className="font-semibold text-[var(--accent)]">
            {t(`คุณอยู่ช่วง ${range(mine)} — มี ${bins[mine].count} คนในช่วงนี้ (รวมคุณ)`, `You are in ${range(mine)} — ${bins[mine].count} ${bins[mine].count === 1 ? "student is" : "students are"} in this range (including you)`)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[var(--accent-bright)]/50" aria-hidden="true" />{t("จำนวนนักศึกษาในแต่ละช่วงคะแนน", "Students per score range")}</span>
        {mine >= 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-[var(--accent-solid)]" aria-hidden="true" />{t("ช่วงของคุณ", "Your range")}</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[var(--text-secondary)]" aria-hidden="true" />{t("ค่าเฉลี่ย", "Average")}</span>
      </figcaption>
    </figure>
  );
}
