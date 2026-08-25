"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCohortStudents } from "@/lib/cohort-students";
import { useCourses } from "@/lib/courses";
import PageHeader from "@/components/PageHeader";

function CheckIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ) : (
    <div className="w-4 h-4 rounded-full border-2 border-gray-300" aria-hidden="true"/>
  );
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const { teachers } = useManagedTeachers();
  const { cohortStudents } = useCohortStudents();
  const { courses } = useCourses();

  const teacherCount = teachers.length;
  const studentCount = cohortStudents.length;
  const courseCount = courses.length;

  const onboardingSteps = [
    {
      done: teacherCount > 0,
      labelTh: "เพิ่มอาจารย์อย่างน้อย 1 คน",
      labelEn: "Add at least 1 teacher",
      href: "/admin/teachers",
    },
    {
      done: studentCount > 0,
      labelTh: "นำเข้านักศึกษา",
      labelEn: "Import students",
      href: "/admin/students",
    },
    {
      done: courseCount > 0,
      labelTh: "มีรายวิชาในระบบ",
      labelEn: "Course exists in system",
      href: "/admin/courses",
    },
    {
      done: courseCount > 0 && teacherCount > 0,
      labelTh: "Assign อาจารย์เข้ารายวิชา",
      labelEn: "Assign teacher to a course",
      href: "/admin/courses",
    },
  ];

  const allDone = onboardingSteps.every((s) => s.done);

  const STAT_CARDS = [
    {
      value: teacherCount,
      labelTh: "อาจารย์ในระบบ",
      labelEn: "Teachers",
      color: "text-[#0F766E]",
      bg: "bg-[#2DD4BF]/10",
    },
    {
      value: studentCount,
      labelTh: "นักศึกษา (cohort)",
      labelEn: "Students (cohort)",
      color: "text-indigo-700",
      bg: "bg-indigo-50",
    },
    {
      value: courseCount,
      labelTh: "รายวิชา",
      labelEn: "Courses",
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
        <PageHeader
          title={t("หน้าหลัก", "Dashboard")}
          description={t("ภาพรวมระบบ HWAI Agent", "HWAI Agent system overview")}
        />

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {STAT_CARDS.map((card) => (
            <div key={card.labelEn} className={`rounded-2xl ${card.bg} p-5`}>
              <p className={`text-3xl font-extrabold tabular-nums ${card.color}`}>{card.value}</p>
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{t(card.labelTh, card.labelEn)}</p>
            </div>
          ))}
        </div>

        {/* Onboarding checklist — hide when all done */}
        {!allDone && (
          <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("เริ่มต้นใช้งาน", "Getting started")}</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {t("ทำตามขั้นตอนนี้เพื่อเริ่มต้นใช้งานระบบ", "Complete these steps to set up the system.")}
            </p>
            <ul role="list" className="mt-4 flex flex-col gap-3">
              {onboardingSteps.map((step) => (
                <li key={step.labelEn} className="flex items-center gap-3">
                  <CheckIcon done={step.done}/>
                  {step.done ? (
                    <span className="text-sm text-[var(--text-muted)] line-through">{t(step.labelTh, step.labelEn)}</span>
                  ) : (
                    <Link href={step.href} className="text-sm text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] rounded">
                      {t(step.labelTh, step.labelEn)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
