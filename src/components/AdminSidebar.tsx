"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";

const COLLAPSED_KEY = "hwai_admin_sidebar_collapsed";

export default function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      try { localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1"); } catch {}
      return !prev;
    });
  }

  // Declared inside component so t() is in scope (CLAUDE.md: never Thai strings at module level)
  const NAV_ITEMS = [
    {
      href: "/admin",
      exact: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
      labelEn: "Dashboard",
      label: t("หน้าหลัก", "Dashboard"),
    },
    {
      href: "/admin/users",
      exact: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      labelEn: "Users",
      label: t("จัดการผู้ใช้", "User Management"),
    },
    {
      href: "/admin/courses",
      exact: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
      labelEn: "Courses",
      label: t("จัดการรายวิชา", "Courses"),
    },
  ];

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      aria-label={t("เมนูผู้ดูแลระบบ", "Admin navigation")}
      className={[
        "shrink-0 h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-all duration-200",
        collapsed ? "w-14" : "w-56",
      ].join(" ")}
    >
      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul role="list" className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.labelEn}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] focus-visible:ring-offset-1",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-[#2DD4BF]/15 text-[#0F766E] border-l-2 border-[#2DD4BF]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  <span className={active ? "text-[#0F766E]" : "text-[var(--text-muted)]"}>
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-4">
        <button
          onClick={toggle}
          title={collapsed ? t("ขยาย sidebar", "Expand sidebar") : t("ย่อ sidebar", "Collapse sidebar")}
          aria-label={collapsed ? t("ขยาย sidebar", "Expand sidebar") : t("ย่อ sidebar", "Collapse sidebar")}
          className={[
            "w-full min-h-[40px] flex items-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]",
            collapsed ? "justify-center px-0" : "gap-2 px-3",
          ].join(" ")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className={collapsed ? "rotate-180" : ""}
            style={{ transition: "transform 0.2s" }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {!collapsed && (
            <span className="text-xs font-medium">{t("ย่อเมนู", "Collapse")}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
