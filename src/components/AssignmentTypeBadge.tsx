"use client";

import { useLanguage } from "@/context/LanguageContext";

/** Individual vs group chip. Teal vs purple plus a person / people icon, so the two stay
 *  distinguishable without relying on colour alone. No border (user preference, 19/9/2569). */
export default function AssignmentTypeBadge({ type, size = "sm" }: { type: "individual" | "group"; size?: "sm" | "md" }) {
  const { t } = useLanguage();
  const isGroup = type === "group";
  const label = isGroup
    ? (size === "md" ? t("งานกลุ่ม", "Group") : t("กลุ่ม", "Group"))
    : (size === "md" ? t("งานเดี่ยว", "Individual") : t("เดี่ยว", "Individual"));
  const colours = isGroup
    ? "bg-[var(--type-group-bg)] text-[var(--type-group-text)]"
    : "bg-[var(--type-solo-bg)] text-[var(--type-solo-text)]";
  const shape = size === "md" ? "px-2.5 py-1 rounded-lg text-xs" : "px-2 py-0.5 rounded-full text-[10px]";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold shrink-0 ${shape} ${colours}`}>
      <svg width={size === "md" ? 12 : 10} height={size === "md" ? 12 : 10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isGroup ? (
          <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        ) : (
          <>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </>
        )}
      </svg>
      {label}
    </span>
  );
}
