"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

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
  const [coursesOpen, setCoursesOpen] = useState(activeCourseId != null || pathname.startsWith("/student/courses"));

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const SUB_LINKS = [
    { key: "announcements", labelTh: "ประกาศ", labelEn: "Announcements" },
    { key: "classwork", labelTh: "งานในชั้นเรียน", labelEn: "Classwork" },
    { key: "evaluation", labelTh: "ผลการประเมิน", labelEn: "Evaluation" },
  ];

  return (
    <aside
      aria-label={t("เมนูนักศึกษา", "Student navigation")}
      className="w-56 shrink-0 h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]"
    >
      {/* Logo strip */}
      <div className="h-14 flex items-center px-5 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#F97316] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)] leading-none">HWAI</p>
            <p className="text-[10px] text-[var(--text-muted)] leading-none mt-0.5">{t("พอร์ทัลนักศึกษา", "Student Portal")}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul role="list" className="flex flex-col gap-0.5">
          {/* Home */}
          <li>
            <Link
              href="/student"
              aria-current={isActive("/student", true) ? "page" : undefined}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1",
                isActive("/student", true)
                  ? "bg-[#F97316]/15 text-[#9A3412] border-l-2 border-[#F97316]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              <span className={isActive("/student", true) ? "text-[#9A3412]" : "text-[var(--text-muted)]"} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              {t("หน้าหลัก", "Home")}
            </Link>
          </li>

          {/* Courses accordion */}
          <li>
            <button
              onClick={() => setCoursesOpen(!coursesOpen)}
              aria-expanded={coursesOpen}
              aria-controls="student-courses-menu"
              className={[
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1",
                pathname.startsWith("/student/courses")
                  ? "text-[#9A3412] bg-[#F97316]/10"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              <span className={pathname.startsWith("/student/courses") ? "text-[#9A3412]" : "text-[var(--text-muted)]"} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </span>
              <span className="flex-1 text-left">{t("รายวิชา", "Courses")}</span>
              <span aria-hidden="true" className={`transition-transform duration-200 ${coursesOpen ? "rotate-180" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>

            {coursesOpen && (
              <ul id="student-courses-menu" role="list" className="mt-0.5 flex flex-col gap-0.5 pl-3">
                {/* Top-level course list link */}
                <li>
                  <Link
                    href="/student/courses"
                    aria-current={isActive("/student/courses", true) ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]",
                      isActive("/student/courses", true)
                        ? "text-[#9A3412] bg-[#F97316]/10"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
                    ].join(" ")}
                  >
                    {t("รายวิชาทั้งหมด", "All Courses")}
                  </Link>
                </li>

                {/* Per-course sub-links (when a course is selected) */}
                {activeCourseId && (
                  <>
                    <li className="px-3 pt-2 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]",
                              active
                                ? "text-[#9A3412] bg-[#F97316]/10 border-l-2 border-[#F97316] ml-1"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
                            ].join(" ")}
                          >
                            {t(sub.labelTh, sub.labelEn)}
                          </Link>
                        </li>
                      );
                    })}
                  </>
                )}
              </ul>
            )}
          </li>

          {/* Calendar (shell only) */}
          <li>
            <Link
              href="/student/calendar"
              aria-current={isActive("/student/calendar") ? "page" : undefined}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-1",
                isActive("/student/calendar")
                  ? "bg-[#F97316]/15 text-[#9A3412] border-l-2 border-[#F97316]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              <span className={isActive("/student/calendar") ? "text-[#9A3412]" : "text-[var(--text-muted)]"} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </span>
              {t("ปฏิทิน", "Calendar")}
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
