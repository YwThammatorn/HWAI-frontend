"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCohortStudents } from "@/lib/cohort-students";
import { findMultiRoleAccount, identityEmail } from "@/lib/accounts";
import { ADMIN_DASHBOARD_DISABLED } from "@/lib/featureFlags";
import type { UserRole } from "@/context/AuthContext";

import Icon from "@/components/Icon";
const ROLE_ROUTE: Record<UserRole, string> = {
  admin:   "/admin",
  teacher: "/teacher/courses",
  ta:      "/teacher/courses",
  student: "/student",
};

const ROLE_LABELS: Record<UserRole, { th: string; en: string; color: string; bg: string }> = {
  admin:   { th: "แอดมิน", en: "Admin",   color: "var(--brand-bright)", bg: "color-mix(in srgb, var(--brand-bright) 15%, transparent)" },
  teacher: { th: "อาจารย์", en: "Teacher", color: "var(--on-chrome-info)", bg: "color-mix(in srgb, var(--on-chrome-info) 15%, transparent)" },
  ta:      { th: "TA",      en: "TA",      color: "var(--on-chrome-ta)", bg: "color-mix(in srgb, var(--on-chrome-ta) 15%, transparent)" },
  student: { th: "นักศึกษา", en: "Student", color: "var(--on-chrome-ok)", bg: "color-mix(in srgb, var(--on-chrome-ok) 15%, transparent)" },
};

// Dev tool (any role, any target) vs. real teacher-facing preview feature
// (teacher only, never admin — see meeting 26/8/2569, [[project-hwai-meeting-20260826]]).
const DEV_SWITCHABLE: UserRole[] = ["admin", "teacher", "ta", "student"];
const TEACHER_PREVIEW_TARGETS: UserRole[] = ["teacher", "ta", "student"];

export default function RoleSwitcher() {
  const { user, viewAs, setViewAs, effectiveRole, switchRole } = useAuth();
  const { t, lang } = useLanguage();
  const { findByStudentId } = useCohortStudents();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDev = process.env.NODE_ENV === "development";
  const isTeacherPreview = user?.role === "teacher";
  const interactive = isDev || isTeacherPreview;
  const switchTargets = isDev ? DEV_SWITCHABLE : TEACHER_PREVIEW_TARGETS;

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

  // One sign-in, several roles (see lib/accounts.ts): a real switch between the
  // roles this account actually holds — never a preview, and never any other role.
  const account = user.roles && user.roles.length > 1 ? findMultiRoleAccount(user.accountEmail) : undefined;
  if (account) {
    const pickRole = (r: UserRole) => {
      setOpen(false);
      if (r !== user.role) {
        const student = r === "student" && account.studentId ? findByStudentId(account.studentId) : undefined;
        switchRole(r, student ? `${student.firstName} ${student.lastName}` : undefined);
      }
      router.push(r === "admin" && ADMIN_DASHBOARD_DISABLED ? "/admin/users" : ROLE_ROUTE[r]);
    };
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("สลับบทบาท", "Switch role")}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors hover:opacity-80"
          style={{ color: meta.color, background: meta.bg, borderColor: `color-mix(in srgb, ${meta.color} 50%, transparent)` }}
        >
          {lang === "th" ? meta.th : meta.en}
          <Icon name="chevron-down" size="xs" style={{ opacity: .6 }} />
        </button>

        {open && (
          <div role="menu" className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-white/10 bg-[var(--chrome-menu-bg)] shadow-xl z-50 py-1 overflow-hidden">
            <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-3 pt-2 pb-1">{t("สลับบทบาท", "Switch role")}</p>
            {account.roles.map((r) => {
              const m = ROLE_LABELS[r];
              const isActive = user.role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => pickRole(r)}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-white/5"
                >
                  <span className="w-2 shrink-0 flex items-center" style={{ color: m.color }}>
                    {isActive && <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-medium" style={{ color: isActive ? m.color : "var(--on-chrome-muted)" }}>
                      {lang === "th" ? m.th : m.en}
                    </span>
                    <span className="text-[10px] text-white/55 truncate">{identityEmail(account, r)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!interactive) {
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
        aria-label={isDev ? "Switch role (dev)" : t("สลับมุมมอง", "Switch view")}
        title={isDev ? "Dev: switch role" : t("ดูหน้าจอในมุมมองอื่น", "Preview as a different role")}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-dashed text-[10px] font-bold transition-colors hover:opacity-80"
        style={{
          color: meta.color,
          background: meta.bg,
          borderColor: `color-mix(in srgb, ${meta.color} 50%, transparent)`,
        }}
      >
        {lang === "th" ? meta.th : meta.en}
        {viewAs && (
          <span className="opacity-60 font-normal">{t("มุมมอง", "view")}</span>
        )}
        <Icon name="chevron-down" size="xs" style={{ opacity: .6 }} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-white/10 bg-[var(--chrome-menu-bg)] shadow-xl z-50 py-1 overflow-hidden">
          <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-3 pt-2 pb-1">{t("ดูในมุมมอง", "View as")}</p>
          {switchTargets.map((r) => {
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
                style={{ color: isActive ? m.color : "var(--on-chrome-faint)" }}
              >
                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
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
              {t(`กลับไปเป็น ${ROLE_LABELS[user.role].th}`, `Reset to ${ROLE_LABELS[user.role].en}`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
