"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { WEEKLY_PLAN_DISABLED, MATERIALS_DISABLED, ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";

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
                  : "text-white/55 hover:text-white hover:bg-white/8",
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
                <li className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
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
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]",
                          active
                            ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                            : "text-white/55 hover:text-white hover:bg-white/8",
                        ].join(" ")}
                      >
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
