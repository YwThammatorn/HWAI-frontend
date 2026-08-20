"use client";

import { useState, useRef } from "react";
import AppShell from "@/components/AppShell";

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
        checked ? "bg-[#0F766E]" : "bg-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
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
        <h2 className={`text-base font-bold ${accent ? "text-[#0F766E]" : "text-[#1B2A4A]"}`}>{title}</h2>
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
      className="w-full accent-[#0F766E] h-1.5 rounded-full"
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

export default function SettingsPage() {
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

  const orig = originalRef.current;
  const isDirty =
    confidence !== orig.confidence || feedback !== orig.feedback ||
    autoRelease !== orig.autoRelease || plagiarism !== orig.plagiarism ||
    lateSubmit !== orig.lateSubmit || autoFeedback !== orig.autoFeedback ||
    strictness !== orig.strictness || theme !== orig.theme ||
    notifAI !== orig.notifAI || notifSystem !== orig.notifSystem;

  function handleSave() {
    originalRef.current = { confidence, feedback, autoRelease, plagiarism, lateSubmit, autoFeedback, strictness, theme, notifAI, notifSystem, googleConnected, teamsConnected };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDiscard() {
    const o = originalRef.current;
    setConfidence(o.confidence); setFeedback(o.feedback);
    setAutoRelease(o.autoRelease); setPlagiarism(o.plagiarism); setLateSubmit(o.lateSubmit);
    setAutoFeedback(o.autoFeedback); setStrictness(o.strictness); setTheme(o.theme);
    setNotifAI(o.notifAI); setNotifSystem(o.notifSystem);
  }

  const strictLabel = strictness < 33 ? "Lenient" : strictness < 66 ? "Balanced" : "Strict";

  return (
    <AppShell>
      <main className="px-10 py-8 max-w-3xl mx-auto pb-28">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1B2A4A]">Application Setting</h1>
            <p className="text-sm text-[#0F766E] mt-0.5">Manage your workspace localization, appearance, and AI behavior.</p>
          </div>

          {/* Grading Preferences */}
          <Section title="Grading Preferences" description="Configure how the AI evaluates student submissions.">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-5">
                {/* Confidence threshold */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[#1B2A4A]">AI Confidence Threshold</p>
                    <span className="text-sm font-bold text-[#0F766E]">{confidence}%</span>
                  </div>
                  <Slider value={confidence} onChange={setConfidence} />
                  <p className="text-xs text-gray-500 mt-2">Assignments below this confidence level will be flagged for manual review.</p>
                </div>

                {/* Feedback style */}
                <div>
                  <p className="text-sm font-medium text-[#1B2A4A] mb-2">Default Feedback Style</p>
                  <div className="flex gap-2">
                    {(["Encouraging", "Concise", "Technical"] as FeedbackStyle[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFeedback(s)}
                        className={[
                          "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors flex-1",
                          feedback === s
                            ? "border-[#0F766E] text-[#0F766E] bg-[#E6FAF8]"
                            : "border-gray-200 text-gray-500 hover:border-gray-300",
                        ].join(" ")}
                      >
                        {FEEDBACK_ICONS[s]}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles right */}
              <div className="space-y-4">
                {[
                  { label: "Auto-release Grades", desc: "Publish grades immediately after AI analysis", value: autoRelease, set: () => setAutoRelease((v) => !v) },
                  { label: "Plagiarism Detection", desc: "Cross-reference with online sources", value: plagiarism, set: () => setPlagiarism((v) => !v) },
                  { label: "Allow Late Submissions", desc: "With automatic penalty deduction", value: lateSubmit, set: () => setLateSubmit((v) => !v) },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1B2A4A]">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={item.set} label={item.label} />
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Grading AI Logic */}
          <Section title="Grading AI Logic" accent>
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#1B2A4A]">Auto-Feedback Generation</p>
                  <p className="text-xs text-[#0F766E] mt-0.5">Automatically draft qualitative feedback for students based on rubric scores.</p>
                </div>
                <Toggle checked={autoFeedback} onChange={() => setAutoFeedback((v) => !v)} label="Auto-Feedback Generation" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[#1B2A4A]">Grading Strictness</p>
                  <span className="text-xs font-semibold text-[#0F766E]">{strictLabel}</span>
                </div>
                <p className="text-xs text-[#0F766E] mb-3">Adjust how lenient or strict the AI should be on partial credit.</p>
                <Slider value={strictness} onChange={setStrictness} />
                <div className="flex justify-between text-xs text-[#0F766E] mt-1">
                  <span>Lenient</span><span>Balanced</span><span>Strict</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <div>
              <p className="text-sm font-medium text-[#1B2A4A]">Interface Theme</p>
              <p className="text-xs text-[#0F766E] mb-3 mt-0.5">Choose how the application looks to you.</p>
              <div className="grid grid-cols-3 gap-3">
                {(["Light", "Dark", "System"] as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={[
                      "rounded-xl border-2 p-2 transition-colors",
                      theme === t ? "border-[#0F766E]" : "border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                  >
                    {THEME_PREVIEW[t]}
                    <p className={`text-xs font-medium mt-1.5 ${theme === t ? "text-[#0F766E]" : "text-gray-500"}`}>{t}</p>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Notification Preferences */}
          <Section title="Notification Preferences" description="Manage how you receive updates and alerts.">
            <div className="space-y-4">
              {[
                { label: "AI Grading Completion", desc: "Receive a digest when AI finishes grading a batch of papers.", value: notifAI, set: () => setNotifAI((v) => !v) },
                { label: "System Updates", desc: "Receive notifications about new features and maintenance.", value: notifSystem, set: () => setNotifSystem((v) => !v) },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#1B2A4A]">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle checked={item.value} onChange={item.set} label={item.label} />
                </div>
              ))}
            </div>
          </Section>

          {/* External Integrations */}
          <Section title="External Integrations" description="Connect your account with third-party education platforms." accent>
            <div className="grid grid-cols-2 gap-4">
              {/* Google Classroom */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-base">🎓</div>
                  <p className="font-semibold text-sm text-[#1B2A4A]">Google Classroom</p>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">Sync classes, assignments, and grades directly with your Google Classroom courses.</p>
                <div className="flex items-center justify-between">
                  {googleConnected
                    ? <span className="text-xs font-medium text-[#0F766E] bg-[#E6FAF8] px-2.5 py-1 rounded-full">Connected</span>
                    : <span className="text-xs text-gray-500">Not Connected</span>
                  }
                  <button
                    onClick={() => setGoogleConnected((v) => !v)}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-[#1B2A4A] hover:bg-gray-50 transition-colors"
                  >
                    {googleConnected ? "Manage Sync" : "Connect"}
                  </button>
                </div>
              </div>
              {/* Microsoft Teams */}
              <div className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-base">💼</div>
                  <p className="font-semibold text-sm text-[#1B2A4A]">Microsoft Teams</p>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">Integrate with Teams for Education to streamline assignment distribution and communication.</p>
                <div className="flex items-center justify-between">
                  {teamsConnected
                    ? <span className="text-xs font-medium text-[#0F766E] bg-[#E6FAF8] px-2.5 py-1 rounded-full">Connected</span>
                    : <span className="text-xs text-gray-500">Not Connected</span>
                  }
                  <button
                    onClick={() => setTeamsConnected((v) => !v)}
                    className={teamsConnected
                      ? "text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-[#1B2A4A] hover:bg-gray-50 transition-colors"
                      : "text-xs font-semibold px-3 py-1.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A] rounded-lg transition-colors"
                    }
                  >
                    {teamsConnected ? "Manage Sync" : "Connect"}
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-2xl border border-red-100 px-6 py-4 flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-red-600">Danger Zone</h2>
              <p className="text-xs text-red-400 mt-0.5">Irreversible actions. Be careful.</p>
            </div>
            <button
              onClick={() => confirm("Reset all settings to default?") && handleDiscard()}
              className="px-4 py-2 text-sm font-medium border border-red-200 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
            >
              Reset All Settings
            </button>
          </div>

        </main>

      {/* Sticky save bar */}
      {(isDirty || saved) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-lg px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1B2A4A]">Save or Discard Changes</p>
            <p className="text-xs text-gray-500 mt-0.5">Once you have done configuring settings, you can save your changes or discard them to reset to default.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDiscard}
              className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className={[
                "px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors",
                saved ? "bg-emerald-500 text-white" : "bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A]",
              ].join(" ")}
            >
              {saved ? "Saved ✓" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
