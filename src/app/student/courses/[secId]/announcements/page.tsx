"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function StudentAnnouncementsPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("ประกาศ", "Announcements")}</h1>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-20 px-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F97316]/10 flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีประกาศ", "No announcements yet")}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t("อาจารย์จะโพสต์ประกาศสำคัญที่นี่", "Your instructor will post important announcements here")}</p>
        </div>
    </div>
  );
}
