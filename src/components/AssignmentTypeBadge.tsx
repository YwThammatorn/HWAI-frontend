"use client";

import { useLanguage } from "@/context/LanguageContext";
import Icon from "@/components/Icon";

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
      <Icon name={isGroup ? "users" : "user"} size="xs" />
      {label}
    </span>
  );
}
