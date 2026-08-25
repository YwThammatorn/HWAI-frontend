"use client";

import { useLanguage } from "@/context/LanguageContext";
import EmptyState from "@/components/EmptyState";

export default function StudentEvaluationPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("ผลการประเมิน", "Evaluation")}</h1>
      <EmptyState
        iconColor="#F97316"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        }
        title={t("ยังไม่มีผลการประเมิน", "No evaluation results yet")}
        description={t("ผลการตรวจงานทั้งหมดจะแสดงที่นี่", "All graded assignment results will appear here")}
      />
    </div>
  );
}
