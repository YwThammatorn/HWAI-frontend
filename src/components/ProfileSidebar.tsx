"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { termLine } from "@/lib/academicTerm";
import { SidebarNavItem, SidebarSectionLabel, SidebarCourseHeader, SIDEBAR_CLASS } from "@/components/SidebarParts";
import { WEEKLY_PLAN_DISABLED, MATERIALS_DISABLED, ANNOUNCEMENTS_DISABLED, TEACHER_HISTORY_DISABLED, TEACHER_DASHBOARD_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
const DASHBOARD_ICON = (
  <Icon name="layout-grid" />
);

const COURSES_ICON = (
  <Icon name="book" />
);

const HISTORY_ICON = (
  <Icon name="clock" />
);

/* ── Course sub-page icons (module-level: no translated strings) ── */

const OVERVIEW_ICON = (
  <Icon name="layout-grid" />
);

const ASSIGNMENTS_ICON = (
  <Icon name="file-text" />
);

const RESULTS_ICON = (
  <Icon name="bar-chart" />
);

const WEEKLY_PLAN_ICON = (
  <Icon name="calendar" />
);

const MATERIALS_ICON = (
  <Icon name="file" />
);

const ANNOUNCEMENTS_ICON = (
  <Icon name="bell" />
);

const STUDENTS_ICON = (
  <Icon name="clipboard-list" />
);

const RUBRICS_ICON = (
  <Icon name="table" />
);

const CALIBRATION_ICON = (
  <Icon name="sliders" />
);

const CLO_ICON = (
  <Icon name="target" />
);

const COLLABORATORS_ICON = (
  <Icon name="users" />
);

const GRADING_ICON = (
  <Icon name="clipboard-check" />
);

const GRADING_SPLIT_ICON = (
  <Icon name="check-square" />
);

const COURSE_SETTINGS_ICON = (
  <Icon name="settings" />
);

// Restored 8/9/2569 at user's request after the flat/AdminSidebar-style rewrite
// earlier this session — the actual layout-shift bug (scrollbar-gutter, see
// AppShell.tsx/AdminShell.tsx/StudentShell.tsx) was unrelated to this
// per-course section, so there's no reason not to have quick per-course links
// here again. MAIN_NAV keeps the Courses-first order from making /teacher/courses
// the landing page — see [[project-hwai-meeting-20260826]].
export default function ProfileSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { effectiveRole } = useAuth();
  const { getCourse } = useCourses();

  // Detect active course from teacher routes /teacher/courses/[id]/...
  const courseMatch = pathname.match(/^\/teacher\/courses\/([^/]+)/);
  const activeCourseId = courseMatch?.[1] ?? null;
  const activeCourse = activeCourseId ? getCourse(activeCourseId) : null;

  function isAt(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Per-assignment sub-pages belong to Grading / Score Book, not to Assignments:
  //   /teacher/courses/[id]/<section>/<assignmentId>/<leaf>
  const seg = pathname.split("/");
  const section = activeCourseId ? seg[4] : undefined;
  const leaf = seg[6];
  // An assignment's "Grading Result" page is reached from Grading (View Results) and is part of it; only the course matrix is the Score Book
  // (advisor, 10/11/2569: the menu highlighted Score Book on the Grading Result page).
  const onGrading = section === "grading" || (section === "assignments" && (leaf === "grading" || leaf === "recheck" || leaf === "results"));
  const onScoreBook = section === "results";
  const onAssignments = section === "assignments" && !onGrading && !onScoreBook;

  const MAIN_NAV = [
    { label: t("รายวิชา", "Courses"),     href: "/teacher/courses",   active: pathname.startsWith("/teacher/courses"), icon: COURSES_ICON   },
    ...(TEACHER_HISTORY_DISABLED ? [] : [
      { label: t("ประวัติ", "History"),     href: "/teacher/history",   active: pathname === "/teacher/history",         icon: HISTORY_ICON   },
    ]),
    ...(TEACHER_DASHBOARD_DISABLED ? [] : [
      { label: t("แดชบอร์ด", "Dashboard"), href: "/teacher/dashboard", active: pathname === "/teacher/dashboard",       icon: DASHBOARD_ICON },
    ]),
  ];

  // Per-course sub-navigation (only shown when inside /courses/[id]/...)
  const ALL_COURSE_NAV = activeCourseId
    ? [
        // Order: 1-2 checked daily, 3-5 grading workflow, 6-8 term-setup/planning,
        // 9-11 course administration (roster/staffing/settings) — proposed to and
        // confirmed by the user 15/9/2569. 21/9/2569: Assignments (planning) split from
        // Grading (checking); Results became the Score Book.
        { label: t("ภาพรวม", "Overview"),        href: `/teacher/courses/${activeCourseId}`,               active: isAt(`/teacher/courses/${activeCourseId}`, true), icon: OVERVIEW_ICON       },
        ...(ANNOUNCEMENTS_DISABLED ? [] : [
          { label: t("ประกาศ", "Announcements"), href: `/teacher/courses/${activeCourseId}/announcements`,       active: isAt(`/teacher/courses/${activeCourseId}/announcements`), icon: ANNOUNCEMENTS_ICON  },
        ]),
        { label: t("งาน/การบ้าน", "Assignments"), href: `/teacher/courses/${activeCourseId}/assignments`,   active: onAssignments, icon: ASSIGNMENTS_ICON   },
        { label: t("ตรวจงาน", "Grading"),         href: `/teacher/courses/${activeCourseId}/grading`,       active: onGrading,     icon: GRADING_ICON        },
        { label: t("สมุดคะแนน", "Score Book"),    href: `/teacher/courses/${activeCourseId}/results`,       active: onScoreBook,   icon: RESULTS_ICON        },
        { label: t("เกณฑ์การให้คะแนน", "Rubrics"), href: `/teacher/courses/${activeCourseId}/rubrics`,       active: isAt(`/teacher/courses/${activeCourseId}/rubrics`),     icon: RUBRICS_ICON        },
        { label: t("ปรับเทียบ AI", "Calibration"), href: `/teacher/courses/${activeCourseId}/calibration`, active: isAt(`/teacher/courses/${activeCourseId}/calibration`), icon: CALIBRATION_ICON    },
        ...(WEEKLY_PLAN_DISABLED ? [] : [
          { label: t("แผนการสอน", "Teaching Plan"), href: `/teacher/courses/${activeCourseId}/weekly-plan`,       active: isAt(`/teacher/courses/${activeCourseId}/weekly-plan`),   icon: WEEKLY_PLAN_ICON    },
        ]),
        ...(MATERIALS_DISABLED ? [] : [
          { label: t("สื่อการสอน", "Materials"), href: `/teacher/courses/${activeCourseId}/materials`,           active: isAt(`/teacher/courses/${activeCourseId}/materials`),     icon: MATERIALS_ICON      },
        ]),
        { label: "CLO", href: `/teacher/courses/${activeCourseId}/clo`,       active: isAt(`/teacher/courses/${activeCourseId}/clo`),           icon: CLO_ICON            },
        { label: t("นักศึกษา", "Students"), href: `/teacher/courses/${activeCourseId}/students`,           active: isAt(`/teacher/courses/${activeCourseId}/students`),      icon: STUDENTS_ICON       },
        { label: t("ผู้ร่วมสอน", "Collaborators"), href: `/teacher/courses/${activeCourseId}/collaborators`, active: isAt(`/teacher/courses/${activeCourseId}/collaborators`), icon: COLLABORATORS_ICON  },
        // 10/11/2569 (advisor R28): the teacher gives a TA the assignments to grade
        { label: t("มอบหมายงานให้ TA", "Assign work to TAs"), href: `/teacher/courses/${activeCourseId}/grading-split`, active: isAt(`/teacher/courses/${activeCourseId}/grading-split`), icon: GRADING_SPLIT_ICON },
        { label: t("ตั้งค่าวิชา", "Settings"),   href: `/teacher/courses/${activeCourseId}/settings`,      active: isAt(`/teacher/courses/${activeCourseId}/settings`),      icon: COURSE_SETTINGS_ICON},
      ]
    : [];

  // A TA's course menu (10/11/2569, the user's list): Overview · Assignments · Grading · Score Book · Students
  const isTa = effectiveRole === "ta";
  const TA_NAV_HREFS = activeCourseId
    ? [`/teacher/courses/${activeCourseId}`, `/teacher/courses/${activeCourseId}/assignments`, `/teacher/courses/${activeCourseId}/grading`, `/teacher/courses/${activeCourseId}/results`, `/teacher/courses/${activeCourseId}/students`]
    : [];
  const COURSE_NAV = isTa ? ALL_COURSE_NAV.filter((i) => TA_NAV_HREFS.includes(i.href)) : ALL_COURSE_NAV;

  return (
    <aside
      aria-label={t("เมนูผู้สอน", "Teacher navigation")}
      className={SIDEBAR_CLASS}
    >
      {/* Inside a course the sidebar is that course's (header block + its pages); "Back to main"
          returns to the top-level list. Outside a course it is the top-level list. */}
      {activeCourseId && COURSE_NAV.length > 0 ? (
        <>
          <SidebarCourseHeader
            backHref="/teacher/courses"
            backLabel={t("กลับหน้าหลัก", "Back to main")}
            code={activeCourse?.code}
            name={activeCourse?.name ?? t("รายวิชา", "Course")}
            termLine={activeCourse ? termLine(activeCourse, t) : undefined}
            section={activeCourse?.sectionNumber ? t(`กลุ่มเรียน ${activeCourse.sectionNumber}`, `Section ${activeCourse.sectionNumber}`) : undefined}
          />
          <nav className="flex flex-col gap-0.5 mb-4" aria-label={activeCourse?.name ?? t("รายวิชา", "Course")}>
            {COURSE_NAV.map((item) => (
              <SidebarNavItem key={item.href} {...item} />
            ))}
          </nav>
        </>
      ) : (
        <>
          <SidebarSectionLabel>{t("หลัก", "Main")}</SidebarSectionLabel>
          <nav className="flex flex-col gap-0.5 mb-4">
            {MAIN_NAV.map((item) => (
              <SidebarNavItem key={item.href} {...item} />
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}
