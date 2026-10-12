"use client";

import { useLanguage } from "@/context/LanguageContext";
import { toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";
import { percentBetterThan, type ExamStats } from "@/lib/examStats";
import ScoreHistogram from "@/components/ScoreHistogram";

const one = (n: number) => n.toFixed(1);
const num = (n: number) => (Number.isInteger(n) ? String(n) : one(n));

/**
 * A student's view of one announced result: their own score against the class's min / average / max / SD,
 * with a bar chart of how many students scored in each range (their own range highlighted) so they can see where they stand.
 * Container-query layout: narrow (the Evaluation grid) stacks it; wide (the exam page) puts the score on
 * the left and the track + figures on the right, so the card fills the width instead of leaving it empty.
 */
export default function ExamStatsCard({ name, maxPoints, stats, myScore, comment, showName = true, headingTag: Heading = "h2", badge, unit }: {
  name: string;
  maxPoints: number;
  stats: ExamStats;
  myScore: number | null;
  comment?: string;
  /** false where the exam name is already the page title right above (it stays as a screen-reader heading). */
  showName?: boolean;
  headingTag?: "h2" | "h3";
  /** Shown next to the name (the teacher's summary puts "Announced" / "Not announced" here). */
  badge?: React.ReactNode;
  /** Appended to the figures when the scale isn't raw points, e.g. "%". */
  unit?: string;
}) {
  const { t } = useLanguage();
  const diff = myScore !== null ? myScore - stats.mean : null;
  const avgPct = maxPoints > 0 ? Math.round((stats.mean / maxPoints) * 100) : null;
  const myPct = myScore !== null && maxPoints > 0 ? Math.round((myScore / maxPoints) * 100) : null;

  const u = unit ?? "";
  const tiles: { label: string; value: string; title?: string }[] = [
    { label: t("ต่ำสุด", "Min"), value: num(Math.round(stats.min * 10) / 10) + u },
    { label: t("เฉลี่ย", "Average"), value: one(stats.mean) + u },
    { label: t("สูงสุด", "Max"), value: num(Math.round(stats.max * 10) / 10) + u },
    { label: "SD", value: stats.sd === null ? "—" : one(stats.sd), title: t("ส่วนเบี่ยงเบนมาตรฐาน", "Standard deviation") },
  ];

  const better = myScore !== null ? percentBetterThan(stats, myScore) : null;

  const betterText = better === null ? null : t(`ดีกว่าเพื่อนร่วมห้อง ${better}%`, `Better than ${better}% of your classmates`);

  const diffText = diff === null ? null
    : Math.abs(diff) < 0.05
      ? t("เท่ากับค่าเฉลี่ยของห้อง", "Right at the class average")
      : diff > 0
        ? t(`สูงกว่าค่าเฉลี่ยของห้อง ${one(diff)} คะแนน`, `${one(diff)} points above the class average`)
        : t(`ต่ำกว่าค่าเฉลี่ยของห้อง ${one(-diff)} คะแนน`, `${one(-diff)} points below the class average`);

  return (
    <section className="@container rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 @2xl:p-7">
      <div className="grid gap-x-12 gap-y-5 @2xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] @2xl:items-center">
        {/* Who / how you did */}
        <div className="flex items-start justify-between gap-4 @2xl:flex-col @2xl:justify-start @2xl:gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading className={showName ? "text-sm font-bold text-[var(--text-primary)] truncate @2xl:text-base @2xl:whitespace-normal" : "sr-only"}>{name}</Heading>
              {badge}
            </div>
            <p className={`text-xs text-[var(--text-muted)] ${showName ? "mt-0.5" : "font-semibold uppercase tracking-wider"}`}>
              {t(`สถิติจากนักศึกษา ${stats.count} คน`, `Class statistics · ${stats.count} student${stats.count === 1 ? "" : "s"}`)}
            </p>
          </div>
          {myScore === null && (
            <div className="shrink-0 text-right @2xl:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("ค่าเฉลี่ยของห้อง", "Class average")}</p>
              <p className="text-2xl font-bold leading-tight tabular-nums text-[var(--text-primary)] @2xl:text-5xl">
                {one(stats.mean)}<span className="text-sm font-semibold text-[var(--text-muted)] @2xl:text-xl">{unit ?? ` / ${maxPoints}`}</span>
              </p>
              {avgPct !== null && unit !== "%" && (
                <span className={`mt-1 inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold tabular-nums @2xl:mt-2 @2xl:h-7 @2xl:px-3 @2xl:text-sm ${SCORE_TONE_CLASSES[toneForPct(avgPct)]}`}>{avgPct}%</span>
              )}
            </div>
          )}
          {myScore !== null && (
            <div className="shrink-0 text-right @2xl:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("คะแนนของคุณ", "Your score")}</p>
              <p className="text-2xl font-bold leading-tight tabular-nums text-[var(--text-primary)] @2xl:text-5xl">
                {num(myScore)}<span className="text-sm font-semibold text-[var(--text-muted)] @2xl:text-xl"> / {maxPoints}</span>
              </p>
              {myPct !== null && (
                <span className={`mt-1 inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold tabular-nums @2xl:mt-2 @2xl:h-7 @2xl:px-3 @2xl:text-sm ${SCORE_TONE_CLASSES[toneForPct(myPct)]}`}>{myPct}%</span>
              )}
              {diffText && <p className="mt-3 hidden text-sm text-[var(--text-secondary)] @2xl:block">{diffText}</p>}
              {betterText && <p className="mt-1 hidden text-sm font-semibold text-[var(--accent)] @2xl:block">{betterText}</p>}
            </div>
          )}
        </div>

        {/* Where you sit in the room */}
        <div className="min-w-0">
          <div className="mb-6">
            <ScoreHistogram scores={stats.scores} maxPoints={maxPoints} myScore={myScore} mean={stats.mean} unit={unit} />
          </div>

          <dl className="grid grid-cols-4 gap-2 @2xl:gap-4">
            {tiles.map((x) => (
              <div key={x.label} title={x.title} className="rounded-xl bg-[var(--bg-app)] px-3 py-2.5 @2xl:px-5 @2xl:py-4">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] @2xl:text-xs">{x.label}</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text-primary)] @2xl:mt-1 @2xl:text-3xl">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {diffText && <p className="mt-3 text-xs text-[var(--text-secondary)] tabular-nums @2xl:hidden">{diffText}</p>}
      {betterText && <p className="mt-1 text-xs font-semibold text-[var(--accent)] @2xl:hidden">{betterText}</p>}
      {comment && (
        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("ความเห็นจากอาจารย์", "Teacher's comment")}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)]">{comment}</p>
        </div>
      )}
    </section>
  );
}
