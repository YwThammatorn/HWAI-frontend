"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const PORTALS: Record<UserRole, string> = {
  teacher: "/teacher/dashboard",
  ta: "/teacher/dashboard",
  student: "/student",
  admin: "/admin",
};

const ALL_ROLES: UserRole[] = ["teacher", "ta", "student", "admin"];

export default function RoleSwitcher() {
  const { user, viewAs, effectiveRole, setViewAs } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const roleLabel = (role: UserRole): string => {
    const map: Record<UserRole, string> = {
      teacher: t("อาจารย์", "Teacher"),
      ta: "TA",
      student: t("นักศึกษา", "Student"),
      admin: "Admin",
    };
    return map[role];
  };

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user || !effectiveRole) return null;

  const isOverriding = viewAs !== null;

  function switchTo(role: UserRole) {
    setOpen(false);
    setViewAs(role === user!.role ? null : role);
    router.push(PORTALS[role]);
  }

  function clearBypass() {
    setViewAs(null);
    router.push(PORTALS[user!.role]);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      {/* Back-to-real-role button (only when bypassing) */}
      {isOverriding && (
        <button
          type="button"
          onClick={clearBypass}
          className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-semibold bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/30 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {roleLabel(user.role)}
        </button>
      )}

      {/* Current role pill / dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-semibold border transition-colors",
          isOverriding
            ? "bg-amber-400/15 text-amber-300 border-amber-400/30 hover:bg-amber-400/25"
            : "text-white/65 border-white/20 hover:text-white hover:bg-white/10 hover:border-white/35",
        ].join(" ")}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        {roleLabel(effectiveRole)}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full right-0 mt-1.5 z-[200] min-w-[148px] rounded-xl overflow-hidden border border-white/10 bg-[#1B2A4A] shadow-2xl"
        >
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
            {t("สลับ role", "Switch role")}
          </p>
          {ALL_ROLES.map((role) => {
            const isActive = effectiveRole === role;
            const isReal = user.role === role;
            return (
              <button
                key={role}
                role="option"
                aria-selected={isActive}
                type="button"
                onClick={() => switchTo(role)}
                className={[
                  "w-full px-3 py-2 flex items-center justify-between gap-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
              >
                <span>{roleLabel(role)}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {isReal && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30 bg-white/10 px-1.5 py-0.5 rounded">
                      {t("จริง", "real")}
                    </span>
                  )}
                  {isActive && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
          <div className="h-1.5" />
        </div>
      )}
    </div>
  );
}
