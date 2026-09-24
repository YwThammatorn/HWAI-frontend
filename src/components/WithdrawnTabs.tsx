"use client";

import { useLanguage } from "@/context/LanguageContext";
import PillTabBar from "@/components/PillTabBar";

export type WithdrawnTab = "active" | "withdrawn";

/**
 * Enrolled / Withdrawn switch, the way My Courses splits Active / Archived. Renders nothing until
 * someone has actually withdrawn, so a course with a clean roster looks exactly as before.
 */
export default function WithdrawnTabs({ tab, onChange, activeCount, withdrawnCount }: {
  tab: WithdrawnTab;
  onChange: (tab: WithdrawnTab) => void;
  activeCount: number;
  withdrawnCount: number;
}) {
  const { t } = useLanguage();
  if (withdrawnCount === 0) return null;
  return (
    <div className="mb-4">
      <PillTabBar
        ariaLabel={t("สถานะนักศึกษา", "Student status")}
        activeKey={tab}
        onChange={(k) => onChange(k as WithdrawnTab)}
        tabs={[
          { key: "active", label: t("ยังเรียนอยู่", "Enrolled"), count: activeCount },
          { key: "withdrawn", label: t("ถอนแล้ว", "Withdrawn"), count: withdrawnCount },
        ]}
      />
    </div>
  );
}
