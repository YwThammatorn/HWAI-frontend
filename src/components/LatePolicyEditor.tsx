"use client";

import { useLanguage } from "@/context/LanguageContext";
import {
  dayAfter, lateDaysCovered, latePenaltyFor, latePolicyProblem, type LatePolicy,
} from "@/lib/assignments";

/**
 * The teacher's late-work settings for one assignment (21/10/2569): until which day work is still accepted and what each
 * late day costs. Used by New and Edit Assignment. Controlled — `value` undefined = late work is not accepted (the
 * assignment closes at its deadline). The preview lists the deduction for each late day, so the numbers are never a surprise.
 */
const MODES: { id: LatePolicy["mode"]; th: string; en: string; thHint: string; enHint: string }[] = [
  { id: "perDay", th: "ต่อวัน", en: "Per day", thHint: "หักเท่ากันทุกวันที่ช้า", enHint: "The same amount for every late day" },
  { id: "tiers", th: "ตามช่วงเวลา", en: "By delay", thHint: "ช้ายิ่งมาก หักยิ่งหนัก เป็นขั้น", enHint: "Steps: the later, the more it costs" },
  { id: "flat", th: "ครั้งเดียว", en: "One-time", thHint: "หักเท่ากัน ช้ากี่วันก็ตาม", enHint: "The same, however late" },
  { id: "none", th: "ไม่หัก", en: "No deduction", thHint: "รับงานช้า แต่ไม่หักคะแนน", enHint: "Late work counts in full" },
];

const DEFAULT_TIERS = [{ untilDay: 1, amount: 10 }, { untilDay: 3, amount: 30 }, { untilDay: 7, amount: 50 }];

const inputCls = "w-24 px-3 py-2 rounded-xl border border-[var(--border)] text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors";

export default function LatePolicyEditor({ value, onChange, dueDate, maxPoints }: {
  value: LatePolicy | undefined;
  onChange: (next: LatePolicy | undefined) => void;
  /** YYYY-MM-DD; empty until the teacher picks one. */
  dueDate: string;
  /** Full score of the assignment, to show the deduction in points. */
  maxPoints: number;
}) {
  const { t } = useLanguage();
  const enabled = !!value;
  const unitWord = value?.unit === "points" ? t("คะแนน", "pts") : "%";

  function toggle() {
    if (enabled) return onChange(undefined);
    onChange({ closeDate: dueDate ? dayAfter(dueDate) : "", mode: "perDay", unit: "percent", amount: 10, tiers: DEFAULT_TIERS });
  }
  const set = (patch: Partial<LatePolicy>) => value && onChange({ ...value, ...patch });
  const num = (raw: string) => (raw === "" ? undefined : Number(raw));

  const problem = value ? latePolicyProblem(value, dueDate) : null;
  const covered = value && dueDate && value.closeDate > dueDate ? lateDaysCovered(dueDate, value.closeDate) : 0;
  const previewDays = Array.from({ length: Math.min(covered, 7) }, (_, i) => i + 1);

  return (
    <div data-testid="late-policy-editor" className="mt-5 border-t border-[var(--border-subtle)] pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{t("รับงานที่ส่งช้า", "Accept late work")}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {dueDate
              ? t("ปิด = รับงานถึงสิ้นวันครบกำหนดเท่านั้น", "Off = work closes at the end of the due date")
              : t("เลือกวันครบกำหนดก่อน", "Pick the due date first")}
          </p>
        </div>
        <button
          type="button" onClick={toggle} disabled={!dueDate}
          aria-label={t("รับงานที่ส่งช้า", "Accept late work")} aria-pressed={enabled}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] disabled:opacity-50 disabled:cursor-not-allowed",
            enabled ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]",
          ].join(" ")}
        >
          <span className={["inline-block h-4 w-4 transform rounded-full bg-[var(--bg-surface)] shadow transition-transform", enabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
        </button>
      </div>

      {value && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="late-close" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t("ปิดรับงานจริงวันที่ (รับถึงสิ้นวันนี้)", "Final closing date (accepted through the end of this day)")}</label>
            <input
              id="late-close" type="date" value={value.closeDate} min={dueDate ? dayAfter(dueDate) : undefined}
              onChange={(e) => set({ closeDate: e.target.value })}
              className="w-56 px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
            />
            {problem === "close" && (
              <p data-testid="late-close-error" className="text-xs text-[var(--s-err-text)] mt-1.5">{t("วันปิดรับต้องหลังวันครบกำหนด", "The closing date must be after the due date")}</p>
            )}
          </div>

          <div>
            <p className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t("หักคะแนนอย่างไร", "How late work is penalised")}</p>
            <div role="radiogroup" aria-label={t("รูปแบบการหักคะแนน", "Deduction style")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODES.map((m) => (
                <button
                  key={m.id} type="button" role="radio" aria-checked={value.mode === m.id}
                  onClick={() => set({ mode: m.id })}
                  className={[
                    "rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]",
                    value.mode === m.id ? "border-[var(--accent)] bg-[var(--accent)]/8" : "border-[var(--border)] hover:border-[var(--accent)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{t(m.th, m.en)}</span>
                  <span className="block text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">{t(m.thHint, m.enHint)}</span>
                </button>
              ))}
            </div>
          </div>

          {value.mode !== "none" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden" role="radiogroup" aria-label={t("หน่วย", "Unit")}>
                {(["percent", "points"] as const).map((u) => (
                  <button
                    key={u} type="button" role="radio" aria-checked={value.unit === u} onClick={() => set({ unit: u })}
                    className={["px-3.5 py-2 text-sm font-medium transition-colors", value.unit === u ? "bg-[var(--bg-nav)] text-white" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"].join(" ")}
                  >
                    {u === "percent" ? t("% ของคะแนนเต็ม", "% of full score") : t("คะแนน", "Points")}
                  </button>
                ))}
              </div>

              {(value.mode === "perDay" || value.mode === "flat") && (
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  {value.mode === "perDay" ? t("หักวันละ", "Lose") : t("หัก", "Lose")}
                  <input
                    type="number" min="0" step="any" aria-label={t("จำนวนที่หัก", "Amount")} value={value.amount ?? ""}
                    onChange={(e) => set({ amount: num(e.target.value) })} className={inputCls}
                  />
                  {unitWord}{value.mode === "perDay" && t(" ต่อวัน", " per day")}
                </label>
              )}
              {value.mode === "perDay" && (
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  {t("สูงสุดไม่เกิน", "Up to")}
                  <input
                    type="number" min="0" step="any" aria-label={t("หักสูงสุด", "Maximum deduction")} value={value.cap ?? ""} placeholder={t("ไม่จำกัด", "no limit")}
                    onChange={(e) => set({ cap: num(e.target.value) })} className={inputCls}
                  />
                  {unitWord}
                </label>
              )}
            </div>
          )}

          {value.mode === "tiers" && (
            <div data-testid="late-tiers" className="flex flex-col gap-2">
              {(value.tiers ?? []).map((tier, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                  {t("ช้าไม่เกิน", "Up to")}
                  <input
                    type="number" min="1" step="1" aria-label={t(`ขั้น ${i + 1} จำนวนวัน`, `Tier ${i + 1} days`)} value={tier.untilDay}
                    onChange={(e) => set({ tiers: (value.tiers ?? []).map((x, j) => (j === i ? { ...x, untilDay: Number(e.target.value) } : x)) })} className={inputCls}
                  />
                  {t("วัน หัก", "days late, lose")}
                  <input
                    type="number" min="0" step="any" aria-label={t(`ขั้น ${i + 1} จำนวนที่หัก`, `Tier ${i + 1} amount`)} value={tier.amount}
                    onChange={(e) => set({ tiers: (value.tiers ?? []).map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)) })} className={inputCls}
                  />
                  {unitWord}
                  <button
                    type="button" onClick={() => set({ tiers: (value.tiers ?? []).filter((_, j) => j !== i) })}
                    disabled={(value.tiers ?? []).length <= 1} aria-label={t(`ลบขั้น ${i + 1}`, `Remove tier ${i + 1}`)}
                    className="h-8 w-8 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--s-err-bd)] hover:text-[var(--s-err-text)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >×</button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  onClick={() => { const ts = value.tiers ?? []; const last = ts[ts.length - 1]; set({ tiers: [...ts, { untilDay: (last?.untilDay ?? 0) + 1, amount: last?.amount ?? 10 }] }); }}
                  className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                >{t("+ เพิ่มขั้น", "+ Add a tier")}</button>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{t("ช้ากว่าขั้นสุดท้ายยังรับได้ถึงวันปิดรับ และหักตามขั้นสุดท้าย", "Work later than the last tier is still accepted until the closing date and pays the last tier")}</p>
              {problem === "tiers" && <p data-testid="late-tiers-error" className="text-xs text-[var(--s-err-text)]">{t("จำนวนวันของแต่ละขั้นต้องไม่ซ้ำกันและเป็นจำนวนเต็ม ≥ 1, ค่าหักต้องไม่ติดลบ (ไม่เกิน 100% ถ้าเป็นเปอร์เซ็นต์)", "Each tier needs a different whole number of days (≥ 1) and a deduction of 0 or more (at most 100% when in percent)")}</p>}
            </div>
          )}
          {problem === "amount" && <p data-testid="late-amount-error" className="text-xs text-[var(--s-err-text)]">{t("ใส่จำนวนที่หัก (0 ขึ้นไป, ไม่เกิน 100% ถ้าเป็นเปอร์เซ็นต์)", "Enter an amount to deduct (0 or more, at most 100% when in percent)")}</p>}

          {!problem && covered > 0 && (
            <div data-testid="late-preview" className="rounded-xl border border-[var(--border-subtle)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{t(`ตัวอย่าง (คะแนนเต็ม ${maxPoints})`, `Preview (full score ${maxPoints})`)}</p>
              <ul className="flex flex-col gap-1 text-sm tabular-nums">
                {previewDays.map((n) => {
                  const cut = latePenaltyFor(value, n, maxPoints);
                  return (
                    <li key={n} className="flex items-center justify-between gap-4">
                      <span className="text-[var(--text-secondary)]">{t(`ส่งช้า ${n} วัน`, `${n} day${n === 1 ? "" : "s"} late`)}</span>
                      <span className={cut > 0 ? "font-semibold text-[var(--s-warn-text)]" : "text-[var(--text-secondary)]"}>
                        {cut > 0 ? t(`หัก ${cut} → ได้สูงสุด ${maxPoints - cut}`, `−${cut} → at most ${maxPoints - cut}`) : t("ไม่หัก", "no deduction")}
                      </span>
                    </li>
                  );
                })}
                {covered > 7 && <li className="text-xs text-[var(--text-secondary)]">{t(`… จนถึงวันที่ ${value.closeDate}`, `… until ${value.closeDate}`)}</li>}
              </ul>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{t("นับเป็นวันตามปฏิทิน และปัดเป็นคะแนนเต็ม — คะแนนไม่ต่ำกว่า 0", "Counted in calendar days and rounded to whole points — a score never goes below 0")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
