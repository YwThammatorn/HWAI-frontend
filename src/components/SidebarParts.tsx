"use client";

import Link from "next/link";

/**
 * The pieces the Teacher and Student portal sidebars share (25/9/2569), so the two read as one
 * pattern: same width and padding; outside a course a "Main" caption + top-level items; inside a
 * course a header block (SidebarCourseHeader) + that course's pages, all the same item size.
 * (AdminSidebar is a different, collapsible shape and stays on its own.)
 */

export const SIDEBAR_CLASS = "w-52 bg-[var(--sidebar-bg)] shrink-0 flex flex-col py-6 px-3 overflow-y-auto";

export function SidebarNavItem({ label, href, icon, active }: {
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 rounded-xl font-medium transition-colors min-h-[44px] [&>svg]:w-4 [&>svg]:h-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--sidebar-bg)]",
        "px-3 py-2.5 text-sm",
        // active = tinted pill + a bar on the sidebar's outer edge (the aside has px-3, hence -right-3)
        active
          ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] after:absolute after:-right-3 after:top-0 after:bottom-0 after:w-1 after:rounded-l after:bg-[var(--accent-bright)]"
          : "text-[var(--sidebar-text-muted)] hover:text-white hover:bg-white/8",
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

/**
 * Inside a course the sidebar switches to that course (26/9/2569, after the user's reference
 * screenshots): a full-bleed header block — back link, course code big, course name, section —
 * followed by the course's pages. Same block for Teacher and Student.
 */
export function SidebarCourseHeader({ backHref, backLabel, code, name, section }: {
  backHref: string;
  backLabel: string;
  code?: string;
  name: string;
  section?: string;
}) {
  return (
    <div className="-mx-3 -mt-6 mb-4 px-4 pt-4 pb-4 bg-white/10 border-b border-white/10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 -ml-1 mb-3 px-1 min-h-[32px] rounded-md text-xs font-semibold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        {backLabel}
      </Link>
      <p className="text-xl font-bold leading-tight text-white tabular-nums break-words">{code ?? name}</p>
      {code && <p className="mt-1 text-sm font-medium leading-snug text-white/90 line-clamp-3">{name}</p>}
      {section && <p className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--sidebar-bg)] truncate">{section}</p>}
    </div>
  );
}
