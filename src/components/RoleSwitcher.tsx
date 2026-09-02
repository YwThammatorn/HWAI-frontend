"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { UserRole } from "@/context/AuthContext";

const ROLE_ROUTE: Record<UserRole, string> = {
  admin:   "/admin",
  teacher: "/teacher/dashboard",
  ta:      "/teacher/dashboard",
  student: "/student",
};

const ROLE_LABELS: Record<UserRole, { th: string; en: string; color: string; bg: string }> = {
  admin:   { th: "แอดมิน", en: "Admin",   color: "#2DD4BF", bg: "rgba(45,212,191,.15)" },
  teacher: { th: "อาจารย์", en: "Teacher", color: "#93C5FD", bg: "rgba(37,99,235,.15)" },
  ta:      { th: "TA",      en: "TA",      color: "#C4B5FD", bg: "rgba(124,58,237,.15)" },
  student: { th: "นักศึกษา", en: "Student", color: "#6EE7B7", bg: "rgba(5,150,105,.15)" },
};

const SWITCHABLE: UserRole[] = ["admin", "teacher", "ta", "student"];

export default function RoleSwitcher() {
  const { user, viewAs, setViewAs, effectiveRole } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  const displayRole = effectiveRole ?? user.role;
  const meta = ROLE_LABELS[displayRole];

  if (!isDev) {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ color: meta.color, background: meta.bg }}
      >
        {lang === "th" ? meta.th : meta.en}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch role (dev)"
        title="Dev: switch role"
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed text-[10px] font-bold transition-colors hover:opacity-80"
        style={{
          color: meta.color,
          background: meta.bg,
          borderColor: meta.color + "80",
        }}
      >
        {lang === "th" ? meta.th : meta.en}
        {viewAs && (
          <span className="opacity-60 font-normal">view</span>
        )}
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: .6 }}>
          <path d="M5 7L1 3h8L5 7z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-white/10 bg-[#0D1628] shadow-xl z-50 py-1 overflow-hidden">
          <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-3 pt-2 pb-1">View as</p>
          {SWITCHABLE.map((r) => {
            const m = ROLE_LABELS[r];
            const isActive = displayRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  const next = r === user.role ? null : r;
                  setViewAs(next);
                  setOpen(false);
                  router.push(ROLE_ROUTE[r]);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 transition-colors hover:bg-white/5"
                style={{ color: isActive ? m.color : "#64748B" }}
              >
                {isActive && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="4"/></svg>
                )}
                {!isActive && <span className="w-2" />}
                {lang === "th" ? m.th : m.en}
              </button>
            );
          })}
          {viewAs && (
            <button
              type="button"
              onClick={() => { setViewAs(null); setOpen(false); router.push(ROLE_ROUTE[user.role]); }}
              className="w-full text-left px-3 py-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors border-t border-white/5 mt-1"
            >
              Reset to {lang === "th" ? ROLE_LABELS[user.role].th : ROLE_LABELS[user.role].en}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
