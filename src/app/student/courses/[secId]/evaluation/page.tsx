"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function StudentEvaluationPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("ผลการประเมิน", "Evaluation")}</h1>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20 px-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F97316]/10 flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีผลการประเมิน", "No evaluation results yet")}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t("ผลการตรวจงานทั้งหมดจะแสดงที่นี่", "All graded assignment results will appear here")}</p>
        </div>
    </div>
  );
}
