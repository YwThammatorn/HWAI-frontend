"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const STRENGTH_LABELS: Record<string, [string, string]> = {
  Weak:   ["อ่อน", "Weak"],
  Fair:   ["พอใช้", "Fair"],
  Good:   ["ดี", "Good"],
  Strong: ["แข็งแกร่ง", "Strong"],
};

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { score: 1, label: "Weak",   color: "#EF4444" },
    { score: 2, label: "Fair",   color: "#F59E0B" },
    { score: 3, label: "Good",   color: "#10B981" },
    { score: 4, label: "Strong", color: "#059669" },
  ];
  return levels[Math.min(score - 1, 3)];
}

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

export default function RegisterPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { t } = useLanguage();

  const FEATURES = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: t("ประหยัดเวลาตรวจงาน 70%", "Save 70% Grading Time"),
      desc: t("AI ตรวจรอบแรกให้ คุณโฟกัสที่ feedback ที่มีคุณค่า", "Automated first-pass reviews let you focus on meaningful feedback."),
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
      title: t("ผู้ช่วย Rubric อัจฉริยะ", "Smart Rubric Assistant"),
      desc: t("สร้างและใช้ Rubric ที่สม่ำเสมอกับทุกงานได้ทันที", "Create and apply consistent grading rubrics across all assignments instantly."),
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      title: t("วิเคราะห์การเรียนรู้เชิงลึก", "Deep Learning Analytics"),
      desc: t("ติดตาม CLO และช่องว่างการเรียนรู้ด้วยการแสดงผลข้อมูล", "Track CLO achievement and identify learning gaps with data visualization."),
    },
  ];

  const [role, setRole] = useState<UserRole>("teacher");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError(t("กรุณากรอกชื่อ-นามสกุล", "Please enter your full name.")); return; }
    if (!email.includes("@")) { setError(t("กรุณากรอกอีเมลสถาบันที่ถูกต้อง", "Please enter a valid school email.")); return; }
    if (password.length < 8) { setError(t("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters.")); return; }
    if (password !== confirm) { setError(t("รหัสผ่านไม่ตรงกัน", "Passwords do not match.")); return; }
    if (!agreed) { setError(t("กรุณายอมรับข้อกำหนดการใช้บริการและนโยบายความเป็นส่วนตัว", "Please agree to the Terms of Service and Privacy Policy.")); return; }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    login({ name: name.trim(), email, role });
    router.replace("/dashboard");
  }

  const eyeIcon = (show: boolean, onToggle: () => void) => (
    <button type="button" onClick={onToggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      {show ? (
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
  );

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col bg-[#1B2A4A] px-12 py-10">
        <HwaiLogo />

        <div className="mt-auto mb-auto">
          <h2 className="text-4xl font-extrabold text-white leading-tight mt-16">
            {t("ตรวจงานฉลาดขึ้น,", "Grade Smarter,")}<br />
            <span className="text-[#2DD4BF]">{t("ไม่หนักขึ้น", "Not Harder.")}</span>
          </h2>
          <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-xs">
            {t(
              "ร่วมกับนักการศึกษาหลายพันคนที่ใช้เครื่องมือ AI ช่วยตรวจงาน",
              "Join thousands of educators reclaiming their weekends with AI-powered assessment tools."
            )}
          </p>

          <div className="mt-8 flex flex-col gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/15 flex items-center justify-center shrink-0 text-[#2DD4BF] mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">
          {t("© 2569 กลุ่มโครงการ HWAI Agent สงวนลิขสิทธิ์", "© 2026 HWAI Agent Project Group. All rights reserved.")}
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
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
            {t("เริ่มต้นใช้งาน HWAI", "Get started with HWAI")}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {t("ทดลองใช้ฟรี ไม่ต้องใช้บัตรเครดิต", "No credit card required for the free trial.")}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {/* Role toggle */}
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t("ฉันเป็น…", "I am a…")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["teacher", "ta"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={[
                      "py-2.5 rounded-xl border text-sm font-semibold transition-all",
                      role === r
                        ? "border-[#2DD4BF] bg-[#E6FAF8] text-[#0F766E]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300",
                    ].join(" ")}
                  >
                    {r === "teacher" ? t("อาจารย์", "Teacher") : t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)")}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("ชื่อ-นามสกุล", "Full Name")}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("เช่น สมชาย ใจดี", "e.g. Jane Doe")}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("อีเมลสถาบัน", "School / Institution Email")}
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
                  placeholder="jane@university.edu"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("ตั้งรหัสผ่าน", "Create Password")}
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
                  placeholder={t("อย่างน้อย 8 ตัวอักษร", "Min. 8 characters")}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                />
                {eyeIcon(showPw, () => setShowPw(!showPw))}
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-full transition-colors"
                        style={{ backgroundColor: i <= strength.score ? strength.color : "#E2E8F0" }}
                      />
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: strength.color }}>
                    {t("ความแข็งแกร่ง:", "Password strength:")} {strength.label ? t(...(STRENGTH_LABELS[strength.label] ?? [strength.label, strength.label])) : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("ยืนยันรหัสผ่าน", "Confirm Password")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("อย่างน้อย 8 ตัวอักษร", "Min. 8 characters")}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] placeholder-gray-400 bg-white focus:outline-none focus:border-[#2DD4BF] focus:ring-2 focus:ring-[#2DD4BF]/20 transition-colors"
                />
                {eyeIcon(showConfirm, () => setShowConfirm(!showConfirm))}
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#2DD4BF] focus:ring-[#2DD4BF]/30"
              />
              <span className="text-sm text-gray-500 leading-relaxed">
                {t("ฉันยอมรับ", "I agree to the")}{" "}
                <a href="#" onClick={(e) => e.preventDefault()} title={t("เร็วๆ นี้", "Coming soon")} className="text-[#0F766E] font-medium hover:underline">
                  {t("ข้อกำหนดการใช้บริการ", "Terms of Service")}
                </a>
                {" "}{t("และ", "and")}{" "}
                <a href="#" onClick={(e) => e.preventDefault()} title={t("เร็วๆ นี้", "Coming soon")} className="text-[#0F766E] font-medium hover:underline">
                  {t("นโยบายความเป็นส่วนตัว", "Privacy Policy")}
                </a>
              </span>
            </label>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#2DD4BF] text-[#1B2A4A] font-bold text-sm hover:bg-[#26bfac] transition-colors disabled:opacity-60"
            >
              {loading ? t("กำลังสร้างบัญชี…", "Creating account…") : t("สร้างบัญชี", "Create Account")}
            </button>
          </form>

          {/* OAuth — disabled until backend OAuth is ready */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{t("หรือสมัครด้วย", "Or sign up with")}</span>
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

          <p className="mt-5 text-center text-sm text-gray-500">
            {t("มีบัญชีอยู่แล้ว?", "Already have an account?")}{" "}
            <Link href="/login" className="text-[#0F766E] font-semibold hover:underline">
              {t("เข้าสู่ระบบ", "Sign in")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
