"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCohortStudents } from "@/lib/cohort-students";

type RoleMode = "teacher" | "student" | "admin";

function HwaiLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-[#2DD4BF] flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
          <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
        </svg>
      </div>
      <span className="font-bold text-[17px] tracking-tight text-white">HWAI Agent</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const { findByStudentId } = useCohortStudents();

  const FEATURES = [
    {
      id: "ai-grading",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      label: t("ตรวจงานด้วย AI ตาม Rubric", "AI-powered rubric grading"),
    },
    {
      id: "clo-tracking",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      label: t("ติดตาม CLO / TABEE", "CLO / TABEE progress tracking"),
    },
    {
      id: "collaboration",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      label: t("จัดการรายวิชาร่วมกัน", "Collaborative course management"),
    },
  ];

  const [roleMode, setRoleMode] = useState<RoleMode>("teacher");
  const [email, setEmail] = useState("");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") router.replace("/admin");
    else if (user.role === "student") router.replace("/student");
    else router.replace("/dashboard");
  }, [user, router]);

  // reset fields when switching role
  function switchRole(mode: RoleMode) {
    setRoleMode(mode);
    setError("");
    setEmail("");
    setStudentIdInput("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (roleMode === "student") {
      if (!studentIdInput.trim()) {
        setError(t("กรุณากรอกรหัสนักศึกษา", "Please enter your student ID."));
        return;
      }
      if (password.length < 4) {
        setError(t("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร", "Password must be at least 4 characters."));
        return;
      }
      setLoading(true);
      await new Promise((r) => setTimeout(r, 400));
      const found = findByStudentId(studentIdInput.trim());
      if (!found) {
        setLoading(false);
        setError(t("ไม่พบรหัสนักศึกษานี้ในระบบ", "Student ID not found in the system."));
        return;
      }
      login({
        name: `${found.firstName} ${found.lastName}`,
        email: found.email,
        role: "student",
        studentId: found.studentId,
      });
      // Let the useEffect redirect handle navigation — do not call router.replace here
      return;
    }

    // teacher / admin mode
    if (!email.includes("@")) {
      setError(t("กรุณากรอกอีเมลที่ถูกต้อง", "Please enter a valid email address."));
      return;
    }
    if (password.length < 8) {
      setError(t("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters."));
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    login({ name, email, role: roleMode });
    // Let the useEffect redirect handle navigation — do not call router.replace here
  }

  const ROLE_TABS: { key: RoleMode; label: string }[] = [
    { key: "teacher", label: t("อาจารย์/ผู้ช่วยสอน", "Teacher / TA") },
    { key: "student", label: t("นักศึกษา", "Student") },
    { key: "admin", label: t("ผู้ดูแลระบบ", "Admin") },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col bg-[#1B2A4A] px-12 py-10">
        <HwaiLogo />

        <div className="mt-auto mb-auto">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            {t("ตรวจงานด้วย", "Grading at the")}<br />
            <span className="text-[#2DD4BF]">{t("ความเร็วแห่งความคิด", "speed of thought.")}</span>
          </h2>
          <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-xs">
            {t(
              "เสริมพลังห้องเรียนด้วย AI ตรวจงานอัตโนมัติ ใช้เวลาตรวจน้อยลง สอนมากขึ้น",
              "Empower your classroom with AI-driven insights. Spend less time grading and more time teaching."
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2DD4BF]/15 flex items-center justify-center shrink-0 text-[#2DD4BF]">
                  {f.icon}
                </div>
                <span className="text-white/80 text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">
          {t("© 2569 กลุ่มโครงการ HWAI Agent สงวนลิขสิทธิ์", "© 2026 HWAI Agent Project Group. All rights reserved.")}
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[var(--bg-app)]">
        <div className="min-h-full flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2DD4BF] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="#1B2A4A" fillOpacity="0.9"/>
                  <rect x="10" y="2" width="6" height="6" rx="1" fill="#1B2A4A" fillOpacity="0.9"/>
                  <rect x="2" y="10" width="6" height="6" rx="1" fill="#1B2A4A" fillOpacity="0.9"/>
                  <rect x="10" y="10" width="6" height="6" rx="1" fill="#1B2A4A" fillOpacity="0.6"/>
                </svg>
              </div>
              <span className="font-bold text-[17px] text-[var(--text-primary)]">HWAI Agent</span>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">
            {t("ยินดีต้อนรับกลับ", "Welcome back")}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {t("กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ", "Please enter your details to sign in.")}
          </p>

          {/* Role toggle tabs */}
          <div className="mt-6 flex rounded-xl border border-gray-200 overflow-hidden" role="tablist" aria-label={t("เลือกประเภทผู้ใช้งาน", "Select account type")}>
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={roleMode === tab.key}
                onClick={() => switchRole(tab.key)}
                className={[
                  "flex-1 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2DD4BF]",
                  roleMode === tab.key
                    ? "bg-[#2DD4BF] text-[#1B2A4A]"
                    : "text-gray-500 hover:text-[var(--text-primary)] hover:bg-gray-50",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
            {roleMode === "student" ? (
              /* Student ID field */
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  {t("รหัสนักศึกษา", "Student ID")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={studentIdInput}
                    onChange={(e) => setStudentIdInput(e.target.value)}
                    placeholder="64070501"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                    required
                  />
                </div>
              </div>
            ) : (
              /* Email field */
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                  {t("อีเมลแอดเดรส", "Email Address")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={roleMode === "admin" ? "admin@school.edu" : "teacher@school.edu"}
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("รหัสผ่าน", "Password")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? t("ซ่อนรหัสผ่าน", "Hide password") : t("แสดงรหัสผ่าน", "Show password")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] rounded"
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#2DD4BF] text-[#1B2A4A] font-bold text-sm hover:bg-[#26bfac] active:scale-[0.98] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2DD4BF]"
            >
              {loading ? t("กำลังเข้าสู่ระบบ…", "Signing in…") : t("เข้าสู่ระบบ", "Sign in")}
            </button>
          </form>

          {/* OAuth divider — teacher/admin only */}
          {roleMode !== "student" && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{t("หรือเข้าสู่ระบบด้วย", "Or continue with")}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  title={t("เร็วๆ นี้", "Coming soon")}
                  className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-[var(--text-primary)] opacity-50 cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  disabled
                  title={t("เร็วๆ นี้", "Coming soon")}
                  className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-[var(--text-primary)] opacity-50 cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 23 23">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                    <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                    <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                    <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                  </svg>
                  Microsoft
                </button>
              </div>
            </>
          )}

          {roleMode !== "admin" && (
            <p className="mt-6 text-center text-sm text-gray-500">
              {roleMode === "student"
                ? t("ไม่พบรหัสนักศึกษา? ติดต่ออาจารย์ผู้สอน", "Can't find your ID? Contact your instructor.")
                : (
                  <>
                    {t("ยังไม่มีบัญชี?", "Don't have an account?")}{" "}
                    <Link href="/register" className="text-[#0F766E] font-semibold hover:underline">
                      {t("สมัครสมาชิก", "Sign Up")}
                    </Link>
                  </>
                )
              }
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
