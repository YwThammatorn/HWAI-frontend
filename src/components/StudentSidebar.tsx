"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { WEEKLY_PLAN_DISABLED, MATERIALS_DISABLED, ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";
import { SidebarNavItem, SidebarSectionLabel, SidebarCourseName, SIDEBAR_CLASS, SIDEBAR_DIVIDER } from "@/components/SidebarParts";

// Same layout, sizes and icon shapes as the teacher sidebar (25/9/2569) — both are built from
// SidebarParts. Icons are module-level: no translated strings.
const icon = (size: number, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {children}
  </svg>
);
const HOME_ICON = icon(16, <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
const SUB_ICONS: Record<string, React.ReactNode> = {
  announcements: icon(14, <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  classwork: icon(14, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>),
  "weekly-plan": icon(14, <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  materials: icon(14, <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />),
  evaluation: icon(14, <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
};

interface CourseLink {
  secId: string;
  name: string;
}

interface StudentSidebarProps {
  courses?: CourseLink[];
}

export default function StudentSidebar({ courses = [] }: StudentSidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  // derive active course from pathname
  const courseMatch = pathname.match(/\/student\/courses\/([^/]+)/);
  const activeCourseId = courseMatch ? courseMatch[1] : null;

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const SUB_LINKS = [
    ...(ANNOUNCEMENTS_DISABLED ? [] : [{ key: "announcements", labelTh: "ประกาศ", labelEn: "Announcements" }]),
    { key: "classwork", labelTh: "งานในชั้นเรียน", labelEn: "Classwork" },
    ...(WEEKLY_PLAN_DISABLED ? [] : [{ key: "weekly-plan", labelTh: "แผนการสอน", labelEn: "Weekly Plan" }]),
    ...(MATERIALS_DISABLED ? [] : [{ key: "materials", labelTh: "สื่อการสอน", labelEn: "Materials" }]),
    { key: "evaluation", labelTh: "ผลการประเมิน", labelEn: "Evaluation" },
  ];

  const courseName = courses.find((c) => c.secId === activeCourseId)?.name ?? t("รายวิชานี้", "This Course");

  return (
    <aside aria-label={t("เมนูนักศึกษา", "Student navigation")} className={SIDEBAR_CLASS}>
      <SidebarSectionLabel>{t("หลัก", "Main")}</SidebarSectionLabel>
      <nav className="flex flex-col gap-0.5 mb-4">
        <SidebarNavItem label={t("หน้าหลัก", "Home")} href="/student" active={isActive("/student", true)} icon={HOME_ICON} />
      </nav>

      {/* Per-course pages — only shown while inside a course */}
      {activeCourseId && (
        <>
          {SIDEBAR_DIVIDER}
          <SidebarCourseName>{courseName}</SidebarCourseName>
          <nav className="flex flex-col gap-0.5 mb-4" aria-label={courseName}>
            {SUB_LINKS.map((sub) => {
              const href = `/student/courses/${activeCourseId}/${sub.key}`;
              return (
                <SidebarNavItem key={sub.key} label={t(sub.labelTh, sub.labelEn)} href={href} active={isActive(href)} icon={SUB_ICONS[sub.key]} small />
              );
            })}
          </nav>
        </>
      )}
    </aside>
  );
}
