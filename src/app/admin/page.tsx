"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCohortStudents } from "@/lib/cohort-students";
import { useCourses } from "@/lib/courses";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";

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

  return (
    <div className="p-6 max-w-4xl">
        <PageHeader
          title={t("หน้าหลัก", "Dashboard")}
          description={t("ภาพรวมระบบ HWAI Agent", "HWAI Agent system overview")}
        />

        {/* Stat cards — shared StatCard component + design-system tokens,
            matching admin/users, admin/courses, admin/curriculum */}
        <div className="mt-6 flex gap-4">
          <StatCard
            label={t("อาจารย์ในระบบ", "Teachers")}
            value={teacherCount}
            color="var(--accent)"
            bg="var(--accent-subtle)"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <StatCard
            label={t("นักศึกษา", "Students")}
            value={studentCount}
            color="var(--s-info-text)"
            bg="var(--s-info-bg)"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            }
          />
          <StatCard
            label={t("รายวิชา", "Courses")}
            value={courseCount}
            color="var(--s-warn-text)"
            bg="var(--s-warn-bg)"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            }
          />
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
                    <Link href={step.href} className="text-sm text-[var(--text-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] rounded">
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
