"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Courses", href: "/courses" },
  { label: "History", href: "/history" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-[#0F2137] text-white h-14 flex items-center px-6 shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 rounded-lg bg-[#2DD4BF] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L14 13H2L8 2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </div>
        <span className="font-semibold text-[15px] tracking-tight">HWAI Agent</span>
      </Link>

      {/* Nav tabs */}
      <div className="flex items-center gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Right side: bell + avatar */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Notifications"
          className="text-white/60 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2a6 6 0 00-6 6v2.586l-1.707 1.707A1 1 0 003 14h14a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM10 18a2 2 0 01-2-2h4a2 2 0 01-2 2z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button
          aria-label="User menu"
          className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center text-[#0F2137] font-bold text-sm"
        >
          T
        </button>
      </div>
    </nav>
  );
}
