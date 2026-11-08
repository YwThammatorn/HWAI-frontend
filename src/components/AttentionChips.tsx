"use client";

import { useLanguage } from "@/context/LanguageContext";
import { ATTENTION_KEYS, type AttentionKey } from "@/lib/gradingInsights";
import { NOTICE_CHIP_CLASSES, SCORE_TONE_CLASSES } from "@/lib/scoreBook";

/**
 * "Who needs a second look" (10/11/2569): one chip per signal that is not zero — AI unsure, low score, teacher changed the AI's score, late.
 * They sit on the assignment's Grading page (each one sets the table filter; also opened from `?filter=`). A chip is always a real button, never a
 * bare label, so it can be pressed without hovering. Nothing flagged → one quiet line saying so.
 */
const TONE: Record<AttentionKey, string> = {
  need_review: NOTICE_CHIP_CLASSES,
  low: SCORE_TONE_CLASSES.err,
  edited: SCORE_TONE_CLASSES.info,
  late: "bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border)]",
};

export default function AttentionChips({ counts, onSelect, active = null }: {
  counts: Record<AttentionKey, number>;
  /** set the filter */
  onSelect?: (key: AttentionKey) => void;
  /** the filter now in force (pressed state) */
  active?: AttentionKey | null;
}) {
  const { t } = useLanguage();
  const label = (k: AttentionKey, n: number) =>
    k === "need_review" ? t(`รอตรวจสอบ ${n}`, `Needs review ${n}`)
    : k === "low" ? t(`คะแนนต่ำ ${n}`, `Low score ${n}`)
    : k === "edited" ? t(`แก้จาก AI ${n}`, `Edited ${n}`)
    : t(`ส่งช้า ${n}`, `Late ${n}`);
  const title = (k: AttentionKey) =>
    k === "need_review" ? t("AI ไม่มั่นใจ — รอให้คุณตรวจสอบ", "The AI was not sure — waiting for your check")
    : k === "low" ? t("ได้ต่ำกว่า 60% ของคะแนนเต็ม", "Scored under 60% of the maximum")
    : k === "edited" ? t("คะแนนที่คุณให้ต่างจากที่ AI ให้", "Your score differs from the AI's")
    : t("ส่งหลังกำหนด", "Handed in after the due date");

  const shown = ATTENTION_KEYS.filter((k) => counts[k] > 0);
  if (shown.length === 0) {
    return <p data-testid="attention-none" className="text-xs text-[var(--text-muted)]">{t("ไม่มีงานที่ต้องดูเป็นพิเศษ", "Nothing needs a second look")}</p>;
  }
  const base = "inline-flex h-7 items-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]";
  return (
    <ul className="flex flex-wrap gap-2" data-testid="attention-chips">
      {shown.map((k) => (
        <li key={k}>
          <button type="button" title={title(k)} data-attention={k} aria-pressed={active === k} onClick={() => onSelect?.(k)}
            className={`${base} ${TONE[k]} underline-offset-2 hover:underline ${active === k ? "ring-2 ring-[var(--accent)]" : ""}`}>{label(k, counts[k])}</button>
        </li>
      ))}
    </ul>
  );
}
