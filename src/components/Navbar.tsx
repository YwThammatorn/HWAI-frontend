"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#1B2A4A] text-white h-14 flex items-center px-6 shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-8">
        <div className="w-8 h-8 rounded-lg bg-[#2DD4BF] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
          </svg>
        </div>
        <span className="font-bold text-[15px] tracking-tight">HWAI Agent</span>
      </Link>

      <div className="flex-1" />

      {/* Right side: bell + avatar + name */}
      <div className="flex items-center gap-3">
        <Link href="/notifications" aria-label="Notifications" className="text-white/60 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <span className="text-sm font-medium text-white/90">Mr. Anderson</span>
        </div>
      </div>
    </nav>
  );
}
