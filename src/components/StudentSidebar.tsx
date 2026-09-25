"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { WEEKLY_PLAN_DISABLED, MATERIALS_DISABLED, ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";

// Course sub-page icons — the same shapes the teacher sidebar uses for the equivalent pages, so the
// two portals read alike (25/9/2569). Module-level: no translated strings.
const svg = (children: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    {children}
  </svg>
);
const ICONS: Record<string, React.ReactNode> = {
  announcements: svg(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  classwork: svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>),
  "weekly-plan": svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  materials: svg(<><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></>),
  evaluation: svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
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

  return (
    <aside
      aria-label={t("เมนูนักศึกษา", "Student navigation")}
      className="w-56 shrink-0 h-full flex flex-col bg-[var(--sidebar-bg)]"
    >
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul role="list" className="flex flex-col gap-0.5">
          {/* Home */}
          <li>
            <Link
              href="/student"
              aria-current={isActive("/student", true) ? "page" : undefined}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--sidebar-bg)]",
                isActive("/student", true)
                  ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                  : "text-[var(--sidebar-text-muted)] hover:text-white hover:bg-white/8",
              ].join(" ")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {t("หน้าหลัก", "Home")}
            </Link>
          </li>

          {/* Per-course sub-links — only shown while inside a course */}
          {activeCourseId && (
            <li>
              <ul role="list" className="mt-0.5 flex flex-col gap-0.5">
                {/* Course name: was a 10px uppercase caption that was hard to read; now a real heading */}
                <li className="px-3 pt-3 pb-2">
                  <span className="block text-sm font-semibold leading-snug text-white line-clamp-2">
                    {courses.find((c) => c.secId === activeCourseId)?.name ?? t("รายวิชานี้", "This Course")}
                  </span>
                </li>
                {SUB_LINKS.map((sub) => {
                  const href = `/student/courses/${activeCourseId}/${sub.key}`;
                  const active = isActive(href);
                  return (
                    <li key={sub.key}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]",
                          active
                            ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                            : "text-[var(--sidebar-text-muted)] hover:text-white hover:bg-white/8",
                        ].join(" ")}
                      >
                        {ICONS[sub.key]}
                        {t(sub.labelTh, sub.labelEn)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
}
