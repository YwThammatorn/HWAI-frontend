"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";

function NavItem({
  label,
  href,
  icon,
  active,
  small,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-xl font-medium transition-colors min-h-[44px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-nav)]",
        small ? "px-3 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
        active ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "text-white/55 hover:text-white hover:bg-white/8",
      ].join(" ")}
    >
      {icon}
      {label}
    </Link>
  );
}

const DASHBOARD_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const COURSES_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const HISTORY_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const PROFILE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const SETTINGS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ── Course sub-page icons (module-level: no translated strings) ── */

const OVERVIEW_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ASSIGNMENTS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RESULTS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const CLO_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const COLLABORATORS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const COURSE_SETTINGS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function ProfileSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { getCourse } = useCourses();

  // Detect active course from teacher routes /courses/[id]/...
  const courseMatch = pathname.match(/^\/courses\/([^/]+)/);
  const activeCourseId = courseMatch?.[1] ?? null;
  const activeCourse = activeCourseId ? getCourse(activeCourseId) : null;

  function isAt(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const MAIN_NAV = [
    { label: t("แดชบอร์ด", "Dashboard"), href: "/dashboard", active: pathname === "/dashboard",       icon: DASHBOARD_ICON },
    { label: t("รายวิชา", "Courses"),     href: "/courses",   active: pathname.startsWith("/courses"), icon: COURSES_ICON   },
    { label: t("ประวัติ", "History"),     href: "/history",   active: pathname === "/history",         icon: HISTORY_ICON   },
  ];

  const ACCOUNT_NAV = [
    { label: t("ข้อมูลส่วนตัว", "Information"), href: "/profile",  active: pathname === "/profile",  icon: PROFILE_ICON  },
    { label: t("ตั้งค่า", "Settings"),           href: "/settings", active: pathname === "/settings", icon: SETTINGS_ICON },
  ];

  // Per-course sub-navigation (only shown when inside /courses/[id]/...)
  const COURSE_NAV = activeCourseId
    ? [
        { label: t("ภาพรวม", "Overview"),        href: `/courses/${activeCourseId}`,               active: isAt(`/courses/${activeCourseId}`, true), icon: OVERVIEW_ICON       },
        { label: t("งาน/การบ้าน", "Assignments"), href: `/courses/${activeCourseId}/assignments`,   active: isAt(`/courses/${activeCourseId}/assignments`),   icon: ASSIGNMENTS_ICON   },
        { label: t("ผลการเรียน", "Results"),      href: `/courses/${activeCourseId}/results`,       active: isAt(`/courses/${activeCourseId}/results`),       icon: RESULTS_ICON        },
        { label: t("CLO", "CLO"),                 href: `/courses/${activeCourseId}/clo`,           active: isAt(`/courses/${activeCourseId}/clo`),           icon: CLO_ICON            },
        { label: t("ผู้ร่วมสอน", "Collaborators"), href: `/courses/${activeCourseId}/collaborators`, active: isAt(`/courses/${activeCourseId}/collaborators`), icon: COLLABORATORS_ICON  },
        { label: t("ตั้งค่าวิชา", "Settings"),   href: `/courses/${activeCourseId}/settings`,      active: isAt(`/courses/${activeCourseId}/settings`),      icon: COURSE_SETTINGS_ICON},
      ]
    : [];

  return (
    <aside
      aria-label={t("เมนูผู้สอน", "Teacher navigation")}
      className="w-52 bg-[var(--bg-nav)] shrink-0 flex flex-col py-6 px-3 overflow-y-auto"
    >
      <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
        {t("หลัก", "Main")}
      </p>
      <nav className="flex flex-col gap-0.5 mb-4">
        {MAIN_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Per-course contextual navigation */}
      {activeCourseId && COURSE_NAV.length > 0 && (
        <>
          <div className="border-t border-white/10 my-1" />
          <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest px-3 mt-4 mb-2 truncate">
            {activeCourse?.name ?? t("รายวิชา", "Course")}
          </p>
          <nav className="flex flex-col gap-0.5 mb-4" aria-label={activeCourse?.name ?? t("รายวิชา", "Course")}>
            {COURSE_NAV.map((item) => (
              <NavItem key={item.href} {...item} small />
            ))}
          </nav>
        </>
      )}

      <div className="border-t border-white/10 my-1" />

      <p className="text-white/55 text-[10px] font-semibold uppercase tracking-widest px-3 mt-4 mb-2">
        {t("บัญชี", "Account")}
      </p>
      <nav className="flex flex-col gap-0.5 flex-1">
        {ACCOUNT_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
