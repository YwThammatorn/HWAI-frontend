"use client";

import Link from "next/link";

/**
 * The pieces the Teacher and Student portal sidebars share (25/9/2569), so the two read as one
 * pattern: same width and padding, a "Main" caption, big items for the top level, small items (with
 * 14px icons) for a course's pages, and the course name as a real heading above them.
 * (AdminSidebar is a different, collapsible shape and stays on its own.)
 */

export const SIDEBAR_CLASS = "w-52 bg-[var(--sidebar-bg)] shrink-0 flex flex-col py-6 px-3 overflow-y-auto";

export function SidebarNavItem({ label, href, icon, active, small }: {
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--sidebar-bg)]",
        small ? "px-3 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
        active ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]" : "text-[var(--sidebar-text-muted)] hover:text-white hover:bg-white/8",
      ].join(" ")}
    >
      {icon}
      {label}
    </Link>
  );
}

export function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--sidebar-text-muted)] text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">{children}</p>;
}

/** The current course's name above its pages — a heading, not a caption (was 10px uppercase). */
export function SidebarCourseName({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold leading-snug text-white px-3 mt-4 mb-2 line-clamp-3">{children}</p>;
}

export const SIDEBAR_DIVIDER = <div className="border-t border-white/10 my-1" />;
