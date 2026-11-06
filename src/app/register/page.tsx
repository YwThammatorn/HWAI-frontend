"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
import BrandLogo, { GoogleLogo, MicrosoftLogo } from "@/components/BrandLogo";
import IconTile from "@/components/IconTile";
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
    { score: 1, label: "Weak",   color: "var(--level-5)" },
    { score: 2, label: "Fair",   color: "var(--level-3)" },
    { score: 3, label: "Good",   color: "var(--level-2)" },
    { score: 4, label: "Strong", color: "var(--level-1)" },
  ];
  return levels[Math.min(score - 1, 3)];
}

function HwaiLogo() {
  return (
    <BrandLogo size="lg" tone="onDark" />
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { t } = useLanguage();

  const FEATURES = [
    {
      icon: "clock" as const,
      title: t("ประหยัดเวลาตรวจงาน 70%", "Save 70% Grading Time"),
      desc: t("AI ตรวจรอบแรกให้ คุณโฟกัสที่ feedback ที่มีคุณค่า", "Automated first-pass reviews let you focus on meaningful feedback."),
    },
    {
      icon: "file-text" as const,
      title: t("ผู้ช่วย Rubric อัจฉริยะ", "Smart Rubric Assistant"),
      desc: t("สร้างและใช้ Rubric ที่สม่ำเสมอกับทุกงานได้ทันที", "Create and apply consistent grading rubrics across all assignments instantly."),
    },
    {
      icon: "bar-chart" as const,
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
    if (user) router.replace("/teacher/courses");
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
    router.replace("/teacher/courses");
  }

  const eyeIcon = (show: boolean, onToggle: () => void) => (
    <IconButton icon={show ? "eye-off" : "eye"} label={show ? t("ซ่อนรหัสผ่าน", "Hide password") : t("แสดงรหัสผ่าน", "Show password")} onClick={onToggle} className="absolute right-1.5 top-1/2 -translate-y-1/2" />
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col bg-[var(--navbar-bg)] px-12 py-10">
        <HwaiLogo />

        <div className="mt-auto mb-auto">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            {t("ตรวจงานฉลาดขึ้น,", "Grade Smarter,")}<br />
            <span className="text-[var(--brand-bright)]">{t("ไม่หนักขึ้น", "Not Harder.")}</span>
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
                <IconTile icon={f.icon} size="sm" tone="brand" className="mt-0.5" />
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
      <div className="flex-1 overflow-y-auto bg-[var(--bg-surface)]">
        <div className="min-h-full flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <BrandLogo size="lg" tone="onLight" />
          </div>

          <h1 className="text-3xl font-extrabold text-[var(--text-primary)]">
            {t("เริ่มต้นใช้งาน HWAI", "Get started with HWAI")}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
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
                        ? "border-[var(--accent-bright)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border)]",
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                  <Icon name="user" />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("อีเมลสถาบัน", "School / Institution Email")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                  <Icon name="mail" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@university.edu"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                {t("ตั้งรหัสผ่าน", "Create Password")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                  <Icon name="lock" />
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
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
                        style={{ backgroundColor: i <= strength.score ? strength.color : "var(--border)" }}
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                  <Icon name="lock" />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--accent-bright)] focus:ring-2 focus:ring-[var(--accent-bright)]/20 transition-colors"
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
                className="mt-0.5 w-4 h-4 rounded border-[var(--border)] text-[var(--accent-bright)] focus:ring-[var(--accent-bright)]/30"
              />
              <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("ฉันยอมรับ", "I agree to the")}{" "}
                <a href="#" onClick={(e) => e.preventDefault()} title={t("เร็วๆ นี้", "Coming soon")} className="text-[var(--accent)] font-medium hover:underline">
                  {t("ข้อกำหนดการใช้บริการ", "Terms of Service")}
                </a>
                {" "}{t("และ", "and")}{" "}
                <a href="#" onClick={(e) => e.preventDefault()} title={t("เร็วๆ นี้", "Coming soon")} className="text-[var(--accent)] font-medium hover:underline">
                  {t("นโยบายความเป็นส่วนตัว", "Privacy Policy")}
                </a>
              </span>
            </label>

            {/* Error */}
            {error && (
              <p className="text-sm text-[var(--s-err-text)] bg-[var(--s-err-bg)] px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] font-bold text-sm hover:bg-[var(--accent-solid-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? t("กำลังสร้างบัญชี…", "Creating account…") : t("สร้างบัญชี", "Create Account")}
            </button>
          </form>

          {/* OAuth — disabled until backend OAuth is ready */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-muted)] font-medium">{t("หรือสมัครด้วย", "Or sign up with")}</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              title={t("เร็วๆ นี้", "Coming soon")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] opacity-50 cursor-not-allowed"
            >
              <GoogleLogo />
              Google
            </button>
            <button
              type="button"
              disabled
              title={t("เร็วๆ นี้", "Coming soon")}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] opacity-50 cursor-not-allowed"
            >
              <MicrosoftLogo />
              Microsoft
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">
            {t("มีบัญชีอยู่แล้ว?", "Already have an account?")}{" "}
            <Link href="/login" className="text-[var(--accent)] font-semibold hover:underline">
              {t("เข้าสู่ระบบ", "Sign in")}
            </Link>
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
