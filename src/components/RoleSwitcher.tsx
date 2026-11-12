"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCohortStudents } from "@/lib/cohort-students";
import { findMultiRoleAccount, identityEmail } from "@/lib/accounts";
import { ADMIN_DASHBOARD_DISABLED } from "@/lib/featureFlags";
import { useTaCourseIds } from "@/lib/taAccess";
import type { UserRole } from "@/context/AuthContext";

import Icon from "@/components/Icon";
const ROLE_ROUTE: Record<UserRole, string> = {
  admin:   "/admin",
  teacher: "/teacher/courses",
  ta:      "/teacher/courses",
  student: "/student",
};

const ROLE_LABELS: Record<UserRole, RoleMeta> = {
  admin:   { th: "แอดมิน", en: "Admin",   color: "var(--brand-bright)", bg: "color-mix(in srgb, var(--brand-bright) 15%, transparent)", icon: "user" },
  teacher: { th: "อาจารย์", en: "Teacher", color: "var(--on-chrome-info)", bg: "color-mix(in srgb, var(--on-chrome-info) 15%, transparent)", icon: "graduation-cap" },
  ta:      { th: "TA",      en: "TA",      color: "var(--on-chrome-ta)", bg: "color-mix(in srgb, var(--on-chrome-ta) 15%, transparent)", icon: "user" },
  student: { th: "นักศึกษา", en: "Student", color: "var(--on-chrome-ok)", bg: "color-mix(in srgb, var(--on-chrome-ok) 15%, transparent)", icon: "user" },
};

type RoleMeta = { th: string; en: string; color: string; bg: string; icon: "user" | "graduation-cap" };
/** the ink on a solid role chip: the top bar's own colour, dark on every role colour (a token, so both chrome themes work) */
const ROLE_INK = "var(--navbar-bg)";

/**
 * The role chip of the top bar, as a button that looks like one (11/11/2569; the advisor circled the old 10px dashed pill and asked "what button is this?").
 * Same height and type size as the language toggle next to it, a person icon in front of the role and a chevron after it; the border is solid, in the role's colour.
 */
function RoleButton({ meta, lang, open, onClick, label, title, testId, suffix }: {
  meta: RoleMeta; lang: "th" | "en"; open: boolean; onClick: () => void; label: string; title?: string; testId?: string; suffix?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      title={title ?? label}
      data-testid={testId}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      style={{ color: ROLE_INK, background: meta.color, borderColor: meta.color }}
    >
      <Icon name={meta.icon} size="sm" />
      {lang === "th" ? meta.th : meta.en}
      {suffix && <span className="font-normal opacity-70">{suffix}</span>}
      <Icon name="chevron-down" size="sm" className={`transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

// Dev tool (any role, any target) vs. real teacher-facing preview feature
// (teacher only, never admin — see meeting 26/8/2569, [[project-hwai-meeting-20260826]]).
const DEV_SWITCHABLE: UserRole[] = ["admin", "teacher", "ta", "student"];
const TEACHER_PREVIEW_TARGETS: UserRole[] = ["teacher", "ta", "student"];

export default function RoleSwitcher() {
  const { user, viewAs, setViewAs, effectiveRole, switchRole, wearHat } = useAuth();
  const taCourseIds = useTaCourseIds();
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

  // A student the teacher appointed as TA (Collaborators page): one real switch between the student's own two hats — never a preview.
  // (An account that already holds several roles uses the menu below.)
  if ((user.role === "student" || user.role === "ta") && user.studentId && taCourseIds.size > 0 && !(user.roles && user.roles.length > 1)) {
    const hats: UserRole[] = ["student", "ta"];
    const pickHat = (h: UserRole) => {
      setOpen(false);
      if (h !== user.role) wearHat(h as "student" | "ta");
      router.push(ROLE_ROUTE[h]);
    };
    return (
      <div ref={ref} className="relative">
        <RoleButton meta={meta} lang={lang} open={open} onClick={() => setOpen((o) => !o)} label={t("สลับบทบาท", "Switch role")} title={t("สลับระหว่างบทบาทนักศึกษากับผู้ช่วยสอน", "Switch between your Student and TA roles")} testId="hat-switch" />
        {open && (
          <div role="menu" className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-white/10 bg-[var(--chrome-menu-bg)] shadow-xl z-50 py-1 overflow-hidden">
            <p className="text-[11px] font-bold tracking-widest uppercase text-white/60 px-3 pt-2 pb-1">{t("สลับบทบาท", "Switch role")}</p>
            {hats.map((h) => {
              const m = ROLE_LABELS[h];
              const isActive = user.role === h;
              return (
                <button
                  key={h}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => pickHat(h)}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-white/5"
                >
                  <span className="w-2 shrink-0 flex items-center" style={{ color: m.color }}>
                    {isActive && <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-medium" style={{ color: isActive ? m.color : "var(--on-chrome-muted)" }}>{lang === "th" ? m.th : m.en}</span>
                    <span className="text-[10px] text-white/55 truncate">
                      {h === "ta" ? t(`ผู้ช่วยสอน ${taCourseIds.size} วิชา`, `Assisting ${taCourseIds.size} ${taCourseIds.size === 1 ? "course" : "courses"}`) : user.email}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
        <RoleButton meta={meta} lang={lang} open={open} onClick={() => setOpen((o) => !o)} label={t("สลับบทบาท", "Switch role")} title={t("สลับบทบาทของบัญชีนี้", "Switch between the roles of this account")} />

        {open && (
          <div role="menu" className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-white/10 bg-[var(--chrome-menu-bg)] shadow-xl z-50 py-1 overflow-hidden">
            <p className="text-[11px] font-bold tracking-widest uppercase text-white/60 px-3 pt-2 pb-1">{t("สลับบทบาท", "Switch role")}</p>
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
        data-testid="role-badge"
        className="inline-flex h-7 cursor-default select-none items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold"
        style={{ color: ROLE_INK, background: meta.color }}
        title={lang === "th" ? "บทบาทของบัญชีนี้" : "The role of this account"}
      >
        <Icon name={meta.icon} size="sm" />
        {lang === "th" ? meta.th : meta.en}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <RoleButton
        meta={meta} lang={lang} open={open} onClick={() => setOpen((o) => !o)}
        label={isDev ? "Switch role (dev)" : t("สลับมุมมอง", "Switch view")}
        title={isDev ? "Dev: switch role" : t("ดูหน้าจอในมุมมองอื่น (ตัวอย่างเท่านั้น ไม่เปลี่ยนบัญชี)", "Preview the screens as another role (a preview only — your account does not change)")}
        suffix={viewAs ? t("· มุมมอง", "· preview") : undefined}
      />

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-white/10 bg-[var(--chrome-menu-bg)] shadow-xl z-50 py-1 overflow-hidden">
          <p className="text-[11px] font-bold tracking-widest uppercase text-white/60 px-3 pt-2 pb-1">{t("ดูในมุมมอง", "View as")}</p>
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
