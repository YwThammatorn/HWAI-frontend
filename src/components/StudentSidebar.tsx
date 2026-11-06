"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { useLanguage } from "@/context/LanguageContext";
import { WEEKLY_PLAN_DISABLED, MATERIALS_DISABLED, ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";
import { termLine } from "@/lib/academicTerm";
import type { Term } from "@/lib/courses";
import { SidebarNavItem, SidebarSectionLabel, SidebarCourseHeader, SIDEBAR_CLASS } from "@/components/SidebarParts";

// Same layout, sizes and icon shapes as the teacher sidebar (25/9/2569) — both are built from
// SidebarParts. Icons are module-level: no translated strings.
const HOME_ICON = <Icon name="home" />;
const SUB_ICONS: Record<string, React.ReactNode> = {
  announcements: <Icon name="bell" />,
  classwork: <Icon name="file-text" />,
  "weekly-plan": <Icon name="calendar" />,
  materials: <Icon name="folder" />,
  evaluation: <Icon name="bar-chart" />,
};

interface CourseLink {
  secId: string;
  name: string;
  code?: string;
  sectionNumber?: string;
  academicYear?: number;
  term?: Term;
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

  const activeCourse = courses.find((c) => c.secId === activeCourseId);
  const courseName = activeCourse?.name ?? t("รายวิชานี้", "This Course");

  return (
    <aside aria-label={t("เมนูนักศึกษา", "Student navigation")} className={SIDEBAR_CLASS}>
      {/* Inside a course the sidebar is that course's — same header block as the teacher's */}
      {activeCourseId ? (
        <>
          <SidebarCourseHeader
            backHref="/student"
            backLabel={t("กลับหน้าหลัก", "Back to main")}
            code={activeCourse?.code}
            name={courseName}
            termLine={activeCourse ? termLine(activeCourse, t) : undefined}
            section={activeCourse?.sectionNumber ? t(`กลุ่มเรียน ${activeCourse.sectionNumber}`, `Section ${activeCourse.sectionNumber}`) : undefined}
          />
          <nav className="flex flex-col gap-0.5 mb-4" aria-label={courseName}>
            {SUB_LINKS.map((sub) => {
              const href = `/student/courses/${activeCourseId}/${sub.key}`;
              return (
                <SidebarNavItem key={sub.key} label={t(sub.labelTh, sub.labelEn)} href={href} active={isActive(href)} icon={SUB_ICONS[sub.key]} />
              );
            })}
          </nav>
        </>
      ) : (
        <>
          <SidebarSectionLabel>{t("หลัก", "Main")}</SidebarSectionLabel>
          <nav className="flex flex-col gap-0.5 mb-4">
            <SidebarNavItem label={t("หน้าหลัก", "Home")} href="/student" active={isActive("/student", true)} icon={HOME_ICON} />
          </nav>
        </>
      )}
    </aside>
  );
}
