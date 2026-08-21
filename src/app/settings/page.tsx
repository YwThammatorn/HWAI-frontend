"use client";

import { useState, useRef, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";
import { useLanguage } from "@/context/LanguageContext";

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={[
        "relative w-11 h-6 rounded-full transition-colors shrink-0",
        checked ? "bg-[var(--accent)]" : "bg-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, accent, children }: {
  title: string; description?: string; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
      <div className="px-6 pt-5 pb-4 border-b border-gray-50">
        <h2 className={`text-base font-bold ${accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ value, onChange, min = 0, max = 100 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[var(--accent)] h-1.5 rounded-full"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FeedbackStyle = "Encouraging" | "Concise" | "Technical";
type Theme = "Light" | "Dark" | "System";

const FEEDBACK_ICONS: Record<FeedbackStyle, React.ReactNode> = {
  Encouraging: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  Concise: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Technical: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
};

const THEME_PREVIEW: Record<Theme, React.ReactNode> = {
  Light: (
    <div className="w-full h-14 rounded-lg bg-gray-100 flex flex-col gap-1 p-2">
      <div className="h-2 w-10 bg-gray-300 rounded" /><div className="h-1.5 w-16 bg-gray-200 rounded" />
    </div>
  ),
  Dark: (
    <div className="w-full h-14 rounded-lg bg-gray-800 flex flex-col gap-1 p-2">
      <div className="h-2 w-10 bg-gray-600 rounded" /><div className="h-1.5 w-16 bg-gray-700 rounded" />
    </div>
  ),
  System: (
    <div className="w-full h-14 rounded-lg overflow-hidden flex">
      <div className="flex-1 bg-gray-100 flex flex-col gap-1 p-2"><div className="h-2 w-5 bg-gray-300 rounded" /></div>
      <div className="flex-1 bg-gray-800 flex flex-col gap-1 p-2"><div className="h-2 w-5 bg-gray-600 rounded" /></div>
    </div>
  ),
};

const PREF_TO_THEME: Record<ThemePreference, Theme> = { light: "Light", dark: "Dark", system: "System" };
const THEME_TO_PREF: Record<Theme, ThemePreference> = { Light: "light", Dark: "dark", System: "system" };

export default function SettingsPage() {
  const { preference, applyPreference, savePreference, revertPreference } = useTheme();
  const { t } = useLanguage();

  const FEEDBACK_LABELS: Record<FeedbackStyle, string> = {
    Encouraging: t("เชิงบวก", "Encouraging"),
    Concise: t("กระชับ", "Concise"),
    Technical: t("เชิงเทคนิค", "Technical"),
  };

  const THEME_LABELS: Record<Theme, string> = {
    Light: t("สว่าง", "Light"),
    Dark: t("มืด", "Dark"),
    System: t("ตามระบบ", "System"),
  };

  const originalRef = useRef({
    confidence: 85, feedback: "Encouraging" as FeedbackStyle,
    autoRelease: false, plagiarism: true, lateSubmit: true,
    autoFeedback: true, strictness: 50, theme: "Light" as Theme,
    notifAI: true, notifSystem: false,
    googleConnected: true, teamsConnected: false,
  });

  const [confidence, setConfidence] = useState(85);
  const [feedback, setFeedback] = useState<FeedbackStyle>("Encouraging");
  const [autoRelease, setAutoRelease] = useState(false);
  const [plagiarism, setPlagiarism] = useState(true);
  const [lateSubmit, setLateSubmit] = useState(true);
  const [autoFeedback, setAutoFeedback] = useState(true);
  const [strictness, setStrictness] = useState(50);
  const [theme, setTheme] = useState<Theme>("Light");
  const [notifAI, setNotifAI] = useState(true);
  const [notifSystem, setNotifSystem] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local theme state with ThemeProvider after it initialises from localStorage
  useEffect(() => {
    const themeVal = PREF_TO_THEME[preference];
    setTheme(themeVal);
    originalRef.current.theme = themeVal;
  }, [preference]);

  const orig = originalRef.current;
  const isDirty =
    confidence !== orig.confidence || feedback !== orig.feedback ||
    autoRelease !== orig.autoRelease || plagiarism !== orig.plagiarism ||
    lateSubmit !== orig.lateSubmit || autoFeedback !== orig.autoFeedback ||
    strictness !== orig.strictness || theme !== orig.theme ||
    notifAI !== orig.notifAI || notifSystem !== orig.notifSystem;

  function handleThemeChange(t: Theme) {
    setTheme(t);
    applyPreference(THEME_TO_PREF[t]); // live preview
  }

  function handleSave() {
    savePreference(THEME_TO_PREF[theme]); // persist selected theme
    originalRef.current = { confidence, feedback, autoRelease, plagiarism, lateSubmit, autoFeedback, strictness, theme, notifAI, notifSystem, googleConnected, teamsConnected };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDiscard() {
    revertPreference(); // revert theme to last saved
    const o = originalRef.current;
    setConfidence(o.confidence); setFeedback(o.feedback);
    setAutoRelease(o.autoRelease); setPlagiarism(o.plagiarism); setLateSubmit(o.lateSubmit);
    setAutoFeedback(o.autoFeedback); setStrictness(o.strictness); setTheme(o.theme);
    setNotifAI(o.notifAI); setNotifSystem(o.notifSystem);
  }

  const strictLabel = strictness < 33 ? t("ผ่อนปรน", "Lenient") : strictness < 66 ? t("สมดุล", "Balanced") : t("เข้มงวด", "Strict");

  return (
    <AppShell>
      <main className="px-10 py-8 max-w-3xl mx-auto pb-28">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("ตั้งค่าแอปพลิเคชัน", "Application Setting")}</h1>
            <p className="text-sm text-[var(--accent)] mt-0.5">{t("จัดการภาษา รูปลักษณ์ และพฤติกรรม AI ของคุณ", "Manage your workspace localization, appearance, and AI behavior.")}</p>
          </div>

          {/* Grading Preferences */}
          <Section title={t("ค่าตั้งการตรวจงาน", "Grading Preferences")} description={t("กำหนดวิธีที่ AI ประเมินงานของนักศึกษา", "Configure how the AI evaluates student submissions.")}>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* Confidence threshold */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t("ค่าความเชื่อมั่น AI", "AI Confidence Threshold")}</p>
                    <span className="text-sm font-bold text-[var(--accent)]">{confidence}%</span>
                  </div>
                  <Slider value={confidence} onChange={setConfidence} />
                  <p className="text-xs text-gray-500 mt-2">{t("งานที่มีค่าความเชื่อมั่นต่ำกว่านี้จะถูกส่งให้ตรวจสอบเพิ่มเติม", "Assignments below this confidence level will be flagged for manual review.")}</p>
                </div>

                {/* Feedback style */}
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-2">{t("รูปแบบ Feedback เริ่มต้น", "Default Feedback Style")}</p>
                  <div className="flex gap-2">
                    {(["Encouraging", "Concise", "Technical"] as FeedbackStyle[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFeedback(s)}
                        className={[
                          "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors flex-1",
                          feedback === s
                            ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-subtle)]"
                            : "border-gray-200 text-gray-500 hover:border-gray-300",
                        ].join(" ")}
                      >
                        {FEEDBACK_ICONS[s]}
                        {FEEDBACK_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles right */}
              <div className="space-y-4">
                {[
                  { label: t("เผยแพร่คะแนนอัตโนมัติ", "Auto-release Grades"), desc: t("เผยแพร่คะแนนทันทีหลัง AI วิเคราะห์เสร็จ", "Publish grades immediately after AI analysis"), value: autoRelease, set: () => setAutoRelease((v) => !v) },
                  { label: t("ตรวจจับการลอกเลียน", "Plagiarism Detection"), desc: t("ตรวจสอบซ้ำกับแหล่งข้อมูลออนไลน์", "Cross-reference with online sources"), value: plagiarism, set: () => setPlagiarism((v) => !v) },
                  { label: t("อนุญาตส่งงานช้า", "Allow Late Submissions"), desc: t("หักคะแนนโดยอัตโนมัติ", "With automatic penalty deduction"), value: lateSubmit, set: () => setLateSubmit((v) => !v) },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={item.set} label={item.label} />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Grading AI Logic */}
          <Section title={t("ตรรกะ AI ตรวจงาน", "Grading AI Logic")} accent>
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t("สร้าง Feedback อัตโนมัติ", "Auto-Feedback Generation")}</p>
                  <p className="text-xs text-[var(--accent)] mt-0.5">{t("ร่าง feedback เชิงคุณภาพให้นักศึกษาโดยอัตโนมัติตามคะแนน Rubric", "Automatically draft qualitative feedback for students based on rubric scores.")}</p>
                </div>
                <Toggle checked={autoFeedback} onChange={() => setAutoFeedback((v) => !v)} label={t("สร้าง Feedback อัตโนมัติ", "Auto-Feedback Generation")} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t("ความเข้มงวดในการตรวจ", "Grading Strictness")}</p>
                  <span className="text-xs font-semibold text-[var(--accent)]">{strictLabel}</span>
                </div>
                <p className="text-xs text-[var(--accent)] mb-3">{t("ปรับว่า AI จะผ่อนปรนหรือเข้มงวดแค่ไหนในการให้คะแนนบางส่วน", "Adjust how lenient or strict the AI should be on partial credit.")}</p>
                <Slider value={strictness} onChange={setStrictness} />
                <div className="flex justify-between text-xs text-[var(--accent)] mt-1">
                  <span>{t("ผ่อนปรน", "Lenient")}</span><span>{t("สมดุล", "Balanced")}</span><span>{t("เข้มงวด", "Strict")}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Appearance */}
          <Section title={t("รูปลักษณ์", "Appearance")}>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("ธีมอินเตอร์เฟซ", "Interface Theme")}</p>
              <p className="text-xs text-[var(--accent)] mb-3 mt-0.5">{t("เลือกรูปแบบการแสดงผลของแอป", "Choose how the application looks to you.")}</p>
              <div className="grid grid-cols-3 gap-3">
                {(["Light", "Dark", "System"] as Theme[]).map((th) => (
                  <button
                    key={th}
                    onClick={() => handleThemeChange(th)}
                    className={[
                      "rounded-xl border-2 p-2 transition-colors",
                      theme === th ? "border-[var(--accent)]" : "border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                  >
                    {THEME_PREVIEW[th]}
                    <p className={`text-xs font-medium mt-1.5 ${theme === th ? "text-[var(--accent)]" : "text-gray-500"}`}>{THEME_LABELS[th]}</p>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Notification Preferences */}
          <Section title={t("การแจ้งเตือน", "Notification Preferences")} description={t("จัดการวิธีรับการอัปเดตและการแจ้งเตือน", "Manage how you receive updates and alerts.")}>
            <div className="space-y-4">
              {[
                { label: t("AI ตรวจงานเสร็จ", "AI Grading Completion"), desc: t("รับสรุปเมื่อ AI ตรวจงานชุดเสร็จ", "Receive a digest when AI finishes grading a batch of papers."), value: notifAI, set: () => setNotifAI((v) => !v) },
                { label: t("อัปเดตระบบ", "System Updates"), desc: t("รับการแจ้งเตือนเกี่ยวกับฟีเจอร์ใหม่และการบำรุงรักษา", "Receive notifications about new features and maintenance."), value: notifSystem, set: () => setNotifSystem((v) => !v) },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle checked={item.value} onChange={item.set} label={item.label} />
                </div>
              ))}
            </div>
          </Section>

          {/* External Integrations */}
          <Section title={t("การเชื่อมต่อภายนอก", "External Integrations")} description={t("เชื่อมต่อบัญชีกับแพลตฟอร์มการศึกษาอื่น", "Connect your account with third-party education platforms.")} accent>
            <div className="grid grid-cols-2 gap-4">
              {/* Google Classroom */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-base">🎓</div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">Google Classroom</p>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">{t("ซิงค์ชั้นเรียน งาน และเกรดกับ Google Classroom โดยตรง", "Sync classes, assignments, and grades directly with your Google Classroom courses.")}</p>
                <div className="flex items-center justify-between">
                  {googleConnected
                    ? <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-full">{t("เชื่อมต่อแล้ว", "Connected")}</span>
                    : <span className="text-xs text-gray-500">{t("ยังไม่เชื่อมต่อ", "Not Connected")}</span>
                  }
                  <button
                    onClick={() => setGoogleConnected((v) => !v)}
                    className={googleConnected
                      ? "text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
                      : "text-xs font-semibold px-3 py-1.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] rounded-lg transition-colors"
                    }
                  >
                    {googleConnected ? t("จัดการการซิงค์", "Manage Sync") : t("เชื่อมต่อ", "Connect")}
                  </button>
                </div>
              </div>
              {/* Microsoft Teams */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base">💼</div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">Microsoft Teams</p>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">{t("รวม Teams for Education เพื่อแจกจ่ายงานและสื่อสารได้อย่างราบรื่น", "Integrate with Teams for Education to streamline assignment distribution and communication.")}</p>
                <div className="flex items-center justify-between">
                  {teamsConnected
                    ? <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-full">{t("เชื่อมต่อแล้ว", "Connected")}</span>
                    : <span className="text-xs text-gray-500">{t("ยังไม่เชื่อมต่อ", "Not Connected")}</span>
                  }
                  <button
                    onClick={() => setTeamsConnected((v) => !v)}
                    className={teamsConnected
                      ? "text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-[var(--text-primary)] hover:bg-gray-50 transition-colors"
                      : "text-xs font-semibold px-3 py-1.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] rounded-lg transition-colors"
                    }
                  >
                    {teamsConnected ? t("จัดการการซิงค์", "Manage Sync") : t("เชื่อมต่อ", "Connect")}
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-2xl border border-red-100 px-6 py-4 flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-red-600">{t("โซนอันตราย", "Danger Zone")}</h2>
              <p className="text-xs text-red-400 mt-0.5">{t("การดำเนินการที่ไม่สามารถย้อนกลับได้ โปรดระวัง", "Irreversible actions. Be careful.")}</p>
            </div>
            <button
              onClick={() => confirm(t("รีเซ็ตการตั้งค่าทั้งหมดเป็นค่าเริ่มต้น?", "Reset all settings to default?")) && handleDiscard()}
              className="px-4 py-2 text-sm font-medium border border-red-200 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
            >
              {t("รีเซ็ตการตั้งค่าทั้งหมด", "Reset All Settings")}
            </button>
          </div>

        </main>

      {/* Sticky save bar */}
      {(isDirty || saved) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-lg px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("บันทึกหรือยกเลิกการเปลี่ยนแปลง", "Save or Discard Changes")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("เมื่อตั้งค่าเสร็จแล้ว สามารถบันทึกหรือยกเลิกเพื่อกลับสู่ค่าเดิม", "Once you have done configuring settings, you can save your changes or discard them to reset to default.")}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDiscard}
              className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {t("ยกเลิก", "Discard")}
            </button>
            <button
              onClick={handleSave}
              className={[
                "px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors",
                saved ? "bg-emerald-500 text-white" : "bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)]",
              ].join(" ")}
            >
              {saved ? t("บันทึกแล้ว ✓", "Saved ✓") : t("บันทึกการเปลี่ยนแปลง", "Save Changes")}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
