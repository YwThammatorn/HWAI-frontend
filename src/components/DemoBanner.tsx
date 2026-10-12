"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * Shown on every page while the session came from HWAI-backend's demo sign-in (no Google), so a
 * demo is never mistaken for a real sign-in. Fixed and click-through, so it never covers controls.
 */
export default function DemoBanner({ email }: { email: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none max-w-[calc(100vw-32px)] rounded-full border border-amber-300 bg-amber-50/95 px-4 py-1.5 text-xs font-semibold text-amber-700 shadow-sm dark:border-amber-700/60 dark:bg-amber-900/80 dark:text-amber-200 truncate"
    >
      {t("โหมดเดโม", "Demo mode")} · {email} · {t("เข้าสู่ระบบโดยไม่ผ่าน Google", "signed in without Google")}
    </div>
  );
}
