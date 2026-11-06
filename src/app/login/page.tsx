"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, LANGUAGE_TOGGLE_DISABLED } from "@/context/LanguageContext";
import { useCohortStudents } from "@/lib/cohort-students";
import { ADMIN_DASHBOARD_DISABLED } from "@/lib/featureFlags";
import type { UserRole } from "@/context/AuthContext";
import { demoStudent } from "@/lib/accounts";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
import BrandLogo, { BrandMark, GoogleLogo } from "@/components/BrandLogo";
import IconTile from "@/components/IconTile";
function HwaiLogo() {
  return (
    <BrandLogo size="lg" tone="onDark" />
  );
}

function detectRole(email: string): UserRole {
  const prefix = email.split("@")[0];
  if (/^\d+$/.test(prefix)) return "student";
  if (prefix.toLowerCase().includes("admin")) return "admin";
  return "teacher";
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const { t, lang, toggleLang } = useLanguage();
  const { findByStudentId } = useCohortStudents();

  const FEATURES = [
    {
      id: "ai-grading",
      icon: "zap" as const,
      label: t("ตรวจงานด้วย AI ตาม Rubric", "AI-powered rubric grading"),
    },
    {
      id: "clo-tracking",
      icon: "activity" as const,
      label: t("ติดตาม CLO / TABEE", "CLO / TABEE progress tracking"),
    },
    {
      id: "collaboration",
      icon: "users" as const,
      label: t("จัดการรายวิชาร่วมกัน", "Collaborative course management"),
    },
  ];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") router.replace(ADMIN_DASHBOARD_DISABLED ? "/admin/users" : "/admin");
    else if (user.role === "student") router.replace("/student");
    else router.replace("/teacher/courses");
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError(t("กรุณากรอกอีเมลที่ถูกต้อง", "Please enter a valid email address."));
      return;
    }

    const role = detectRole(email);
    const minPw = role === "student" ? 4 : 8;

    if (password.length < minPw) {
      setError(
        role === "student"
          ? t("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร", "Password must be at least 4 characters.")
          : t("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters.")
      );
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    if (role === "student") {
      const prefix = email.split("@")[0];
      const found = findByStudentId(prefix);
      if (!found) {
        setLoading(false);
        setError(t("ไม่พบบัญชีนักศึกษานี้ในระบบ", "Student account not found in the system."));
        return;
      }
      login({
        name: `${found.firstName} ${found.lastName}`,
        email,
        role: "student",
        studentId: found.studentId,
      });
      return;
    }

    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    login({ name, email, role });
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left panel — branding */}
      <div data-testid="login-brand" className="relative hidden lg:flex lg:w-[42%] flex-col overflow-hidden bg-[var(--navbar-bg)] px-12 py-10">
        {/* the logo's four squares, drawn large and faint — the same mark as the top bar, used as the panel's one decoration */}
        <BrandMark className="pointer-events-none absolute -top-32 -right-32 h-[24rem] w-[24rem] text-white opacity-[0.05]" />
        <HwaiLogo />

        <div className="relative mt-auto mb-auto">
          <h2 className="text-4xl font-extrabold text-white leading-tight [text-wrap:balance]">
            {t("ตรวจงานด้วย", "Grading at the")}<br />
            <span className="text-[var(--brand-bright)]">{t("ความเร็วแห่งความคิด", "speed of thought.")}</span>
          </h2>
          <p className="mt-4 text-white/75 text-sm leading-relaxed max-w-xs [text-wrap:pretty]">
            {t(
              "เสริมพลังห้องเรียนด้วย AI ตรวจงานอัตโนมัติ ใช้เวลาตรวจน้อยลง สอนมากขึ้น",
              "Empower your classroom with AI-driven insights. Spend less time grading and more time teaching."
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <IconTile icon={f.icon} size="sm" tone="brand" />
                <span className="text-white/90 text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/70 text-xs">
          {t("© 2569 กลุ่มโครงการ HWAI Agent สงวนลิขสิทธิ์", "© 2026 HWAI Agent Project Group. All rights reserved.")}
        </p>
      </div>

      {/* Right panel — form */}
      <div className="relative flex-1 overflow-y-auto bg-[var(--bg-surface)] dark:bg-[var(--bg-app)]">
        {/* language toggle: same control as the top bar, available before signing in */}
        {!LANGUAGE_TOGGLE_DISABLED && (
          <button
            type="button" onClick={toggleLang} aria-label="Toggle language"
            className="absolute right-6 top-5 z-10 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-semibold tracking-wide text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {lang === "th" ? "TH" : "EN"}
          </button>
        )}
        <div className="min-h-full flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[420px]">
            {/* Mobile logo */}
            <div className="lg:hidden mb-8 flex justify-center">
              <BrandLogo size="lg" tone="onLight" />
            </div>

            <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">
              {t("ยินดีต้อนรับกลับ", "Welcome back")}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              {t("กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ", "Enter your email and password to sign in.")}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  {t("อีเมล", "Email")}
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <Icon name="mail" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kmitl.ac.th"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] dark:bg-[var(--bg-card)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  {t("รหัสผ่าน", "Password")}
                </label>
                <div className="relative">
                  <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                    <Icon name="lock" />
                  </span>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] dark:bg-[var(--bg-card)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
                    required
                  />
                  <IconButton icon={showPw ? "eye-off" : "eye"} label={showPw ? t("ซ่อนรหัสผ่าน", "Hide password") : t("แสดงรหัสผ่าน", "Show password")} onClick={() => setShowPw(!showPw)} className="absolute right-1.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-[var(--s-err-text)] bg-[var(--s-err-bg)] border border-[var(--s-err-bd)] px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] font-bold text-sm hover:bg-[var(--accent-solid-hover)] active:scale-[0.98] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-bright)]"
              >
                {loading ? t("กำลังเข้าสู่ระบบ…", "Signing in…") : t("เข้าสู่ระบบ", "Sign in")}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">{t("หรือเข้าสู่ระบบด้วย", "Or continue with")}</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled
                title={t("เร็วๆ นี้", "Coming soon")}
                className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] opacity-50 cursor-not-allowed"
              >
                <GoogleLogo />
                Google
              </button>
            </div>


            {/* ── DEV BYPASS — only in development build ── */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-6 rounded-xl border border-dashed border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] p-4">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--s-warn-text)] mb-3">
                  Dev Bypass
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { role: "admin" as UserRole, label: "Admin", email: "admin@kmitl.ac.th", name: "Dev Admin" },
                      { role: "teacher" as UserRole, label: "Teacher", email: "teacher@kmitl.ac.th", name: "Dev Teacher" },
                      // 69070101 (29/9/2569, was the stale "64070501" — that id exists in no current mock seed at
                      // all, so this button logged into an empty account). 69070101 is present in every seed
                      // combination (base [5], the 57-student [12], and the [14] term-history extras), so this
                      // shortcut always has something to show regardless of which console commands were run.
                      { role: "student" as UserRole, label: "Student", email: "69070101@kmitl.ac.th", name: "สมชาย ใจดี", studentId: "69070101" },
                    ] satisfies Array<{ role: UserRole; label: string; email: string; name: string; studentId?: string }>
                  ).map(({ role, label, email: devEmail, name, studentId }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        // the demo student can be swapped for another one on this machine (lib/accounts.ts demoStudent)
                        const swap = role === "student" ? demoStudent() : null;
                        logout();
                        login(swap
                          ? { name: swap.name ?? name, email: `${swap.studentId}@kmitl.ac.th`, role, studentId: swap.studentId }
                          : { name, email: devEmail, role, ...(studentId ? { studentId } : {}) });
                      }}
                      className="py-2 rounded-lg text-xs font-semibold border border-[var(--s-warn-bd)] bg-[var(--bg-surface)] text-[var(--s-warn-text)] hover:bg-[var(--s-warn-bg)] transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
