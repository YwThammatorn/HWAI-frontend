"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const MAIN_NAV = [
  {
    label: "Dashboard",
    href: "/dashboard",
    match: (p: string) => p === "/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Courses",
    href: "/courses",
    match: (p: string) => p.startsWith("/courses"),
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    match: (p: string) => p === "/history",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
];

const ACCOUNT_NAV = [
  {
    label: "Information",
    href: "/profile",
    match: (p: string) => p === "/profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    match: (p: string) => p === "/settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/notifications",
    match: (p: string) => p === "/notifications",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

function NavItem({ label, href, icon, active }: { label: string; href: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "text-white/55 hover:text-white hover:bg-white/8",
      ].join(" ")}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function ProfileSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-52 bg-[#1B2A4A] shrink-0 flex flex-col py-6 px-3">
      {/* Main navigation */}
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Main</p>
      <nav className="flex flex-col gap-0.5 mb-4">
        {MAIN_NAV.map((item) => (
          <NavItem key={item.href} {...item} active={item.match(pathname)} />
        ))}
      </nav>

      <div className="border-t border-white/10 my-1" />

      {/* Account navigation */}
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest px-3 mt-4 mb-2">Account</p>
      <nav className="flex flex-col gap-0.5 flex-1">
        {ACCOUNT_NAV.map((item) => (
          <NavItem key={item.href} {...item} active={item.match(pathname)} />
        ))}
      </nav>

      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/8 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </aside>
  );
}
