"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useWeeklyPlan } from "@/lib/weeklyPlan";
import EmptyState from "@/components/EmptyState";
import { WEEKLY_PLAN_DISABLED } from "@/lib/featureFlags";

export default function StudentWeeklyPlanPage() {
  const { secId } = useParams<{ secId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getWeeklyPlanByCourse } = useWeeklyPlan();

  useEffect(() => {
    if (WEEKLY_PLAN_DISABLED) router.replace(`/student/courses/${secId}/classwork`);
  }, [router, secId]);

  const course = getCourse(secId);
  const items = course ? getWeeklyPlanByCourse(secId) : [];

  if (WEEKLY_PLAN_DISABLED) return null;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("แผนการสอนรายสัปดาห์", "Weekly Plan")}</h1>

      {items.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
          title={t("ยังไม่มีแผนการสอน", "No weekly plan yet")}
          description={t("อาจารย์ยังไม่ได้เพิ่มแผนการสอนรายสัปดาห์", "Your instructor hasn't posted a weekly plan yet")}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={[
                "flex items-start gap-4 py-4 px-5",
                idx < items.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
              ].join(" ")}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-bold tabular-nums mt-0.5">
                W{item.week}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{item.topic}</p>
                {item.notes && <p className="text-xs text-[var(--text-muted)] mt-1">{item.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
