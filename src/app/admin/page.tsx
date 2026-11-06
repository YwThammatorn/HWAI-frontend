"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCohortStudents } from "@/lib/cohort-students";
import { useCourses } from "@/lib/courses";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { ADMIN_DASHBOARD_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
function CheckIcon({ done }: { done: boolean }) {
  return done ? (
    <Icon name="check" className="text-[var(--s-ok-text)]" />
  ) : (
    <div className="w-4 h-4 rounded-full border-2 border-[var(--border)]" aria-hidden="true"/>
  );
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const router = useRouter();
  const { teachers } = useManagedTeachers();
  const { cohortStudents } = useCohortStudents();
  const { courses } = useCourses();

  useEffect(() => {
    if (ADMIN_DASHBOARD_DISABLED) router.replace("/admin/users");
  }, [router]);

  if (ADMIN_DASHBOARD_DISABLED) return null;

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
            tone="accent" icon="users"
          />
          <StatCard
            label={t("นักศึกษา", "Students")}
            value={studentCount}
            tone="info" icon="graduation-cap"
          />
          <StatCard
            label={t("รายวิชา", "Courses")}
            value={courseCount}
            tone="warn" icon="book"
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
