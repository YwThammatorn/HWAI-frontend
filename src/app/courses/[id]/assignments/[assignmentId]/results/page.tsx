"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useAssignments, Submission } from "@/lib/assignments";

const AVATAR_COLORS = ["#4F46E5", "#7C3AED", "#BE185D", "#B45309", "#047857", "#0369A1", "#C2410C", "#0E7490"];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();
}

function gradeLetter(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradeBgClass(l: string) {
  return ({ A:"bg-green-100",B:"bg-blue-100",C:"bg-yellow-100",D:"bg-orange-100",F:"bg-red-100" }[l]??"bg-gray-100");
}
function gradeTextClass(l: string) {
  return ({ A:"text-green-700",B:"text-blue-700",C:"text-yellow-700",D:"text-orange-700",F:"text-red-700" }[l]??"text-gray-500");
}
function gradeClass(l: string) { return `${gradeBgClass(l)} ${gradeTextClass(l)}`; }

function confidence(sub: Submission, max: number): { label: string; color: string; pct: number } {
  const score = sub.aiScore ?? 0;
  const pct = (score / max) * 100;
  if (pct >= 85) return { label: "High", color: "#0F766E", pct: 92 };
  if (pct >= 65) return { label: "Medium", color: "#B45309", pct: 72 };
  return { label: "Review", color: "#DC2626", pct: 48 };
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="text-2xl transition-transform hover:scale-110"
        >
          <span style={{ color: i <= (hover || value) ? "#F59E0B" : "#E5E7EB" }}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment } = useAssignments();

  const [search, setSearch] = useState("");
  const [starRating, setStarRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const allSubs = getSubmissionsByAssignment(assignmentId);

  if (!course || !assignment) {
    return (
      <AppShell>
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          ไม่พบข้อมูล —{" "}
          <Link href={`/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            กลับหน้างาน
          </Link>
        </main>
      </AppShell>
    );
  }

  const max = assignment.maxPoints;
  const scoredSubs = allSubs.filter((s) => s.aiScore !== null || s.instructorScore !== null);
  const avgScore =
    scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.instructorScore ?? s.aiScore ?? 0), 0) / scoredSubs.length
      : null;

  const gradeCounts: Record<string, number> = { F: 0, D: 0, C: 0, B: 0, A: 0 };
  scoredSubs.forEach((s) => {
    const score = s.instructorScore ?? s.aiScore ?? 0;
    gradeCounts[gradeLetter(score, max)]++;
  });
  const maxCount = Math.max(1, ...Object.values(gradeCounts));

  const filtered = allSubs.filter((s) =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const requiresAttention = [...scoredSubs]
    .filter((s) => ((s.instructorScore ?? s.aiScore ?? 0) / max) * 100 < 60)
    .sort((a, b) => (a.instructorScore ?? a.aiScore ?? 0) - (b.instructorScore ?? b.aiScore ?? 0))
    .slice(0, 3);

  const topPerformer = scoredSubs.length > 0
    ? scoredSubs.reduce((best, s) =>
        (s.instructorScore ?? s.aiScore ?? 0) > (best.instructorScore ?? best.aiScore ?? 0) ? s : best
      )
    : null;

  function exportCSV() {
    const rows = [
      ["Student Name", "Email", "Score", "Max", "Grade", "Status"],
      ...allSubs.map((s) => {
        const score = s.instructorScore ?? s.aiScore ?? "";
        const letter = score !== "" ? gradeLetter(Number(score), max) : "—";
        return [s.studentName, s.email, score, max, letter, s.status];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assignment?.name ?? "results"}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <main className="w-full max-w-[1200px] mx-auto px-8 py-8">
        {/* Back link */}
        <Link
          href={`/courses/${id}/assignments/${assignmentId}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[var(--accent)] transition-colors mb-4"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Assignments
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              Grading Result : {assignment.name}
            </h1>
            <p className="text-sm text-gray-400">
              Graded on{" "}
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
              at 11:59 PM
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/courses/${id}/assignments`}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Back to Course
            </Link>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-sm font-semibold transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Result
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Processed",
              value: allSubs.filter((s) => s.status === "graded").length,
              sub: "completed",
              color: "#059669",
              icon: (
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              ),
            },
            {
              label: "Total Files",
              value: allSubs.length,
              sub: "submissions",
              color: "#1B2A4A",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              ),
            },
            {
              label: "Needs Review",
              value: allSubs.filter((s) => s.status === "need_review").length,
              sub: "Pending",
              color: "#D97706",
              icon: (
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
              ),
            },
            {
              label: "Avg. Score",
              value: avgScore !== null ? avgScore.toFixed(1) : "—",
              sub: "so far",
              color: "#1B2A4A",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ),
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{s.label}</p>
                {s.icon}
              </div>
              <p className="text-3xl font-bold" style={{ color: s.color }}>
                {s.value}{" "}
                <span className="text-sm font-normal text-gray-400">{s.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex gap-5">
          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Grade distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Grade Distribution</h2>
                </div>
                <button className="text-xs text-[var(--accent)] hover:underline">View Details</button>
              </div>
              <div className="flex items-end justify-around h-32 gap-3">
                {["F", "D", "C", "B", "A"].map((letter) => {
                  const count = gradeCounts[letter];
                  const heightPct = (count / maxCount) * 100;
                  return (
                    <div key={letter} className="flex flex-col items-center gap-2 flex-1">
                      <span className="text-xs text-gray-400">{count}</span>
                      <div
                        className={`w-full rounded-t-lg transition-all border ${count > 0 ? `${gradeBgClass(letter)} border-gray-200` : "bg-gray-100 border-gray-100"}`}
                        style={{ height: `${Math.max(4, heightPct)}%`, minHeight: "4px" }}
                      />
                      <span className={`text-xs font-semibold ${count > 0 ? gradeTextClass(letter) : "text-gray-400"}`}>
                        {letter}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student results table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Student Results</h2>
                <div className="relative">
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">
                  {search ? "ไม่พบนักศึกษาที่ค้นหา" : "ยังไม่มีการส่งงาน"}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Confidence</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((s) => {
                      const score = s.instructorScore ?? s.aiScore;
                      const letter = score !== null ? gradeLetter(score, max) : null;
                      const conf = score !== null ? confidence(s, max) : null;
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: avatarColor(s.studentName) }}
                              >
                                {initials(s.studentName)}
                              </div>
                              <div>
                                <p className="font-medium text-[var(--text-primary)] text-sm">{s.studentName}</p>
                                <p className="text-xs text-gray-400">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {score !== null && letter ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {score}/{max}
                                </span>
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${gradeClass(letter)}`}>
                                  {letter}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not graded</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {conf ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${conf.pct}%`, backgroundColor: conf.color }}
                                  />
                                </div>
                                <span className="text-xs font-medium" style={{ color: conf.color }}>
                                  {conf.label}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              {s.status === "need_review" ? (
                                <>
                                  <Link
                                    href={`/courses/${id}/assignments/${assignmentId}/recheck?sub=${s.id}`}
                                    className="text-xs text-amber-600 hover:underline font-medium"
                                  >
                                    Review
                                  </Link>
                                  <Link
                                    href={`/courses/${id}/assignments/${assignmentId}/recheck?sub=${s.id}`}
                                    className="px-3 py-1.5 rounded-lg bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-xs font-semibold transition-colors"
                                  >
                                    Recheck
                                  </Link>
                                </>
                              ) : (
                                <Link
                                  href={`/courses/${id}/assignments/${assignmentId}/recheck?sub=${s.id}`}
                                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                  View Details
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-64 shrink-0 space-y-4">
            {/* Requires attention */}
            {requiresAttention.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Requires Attention
                </p>
                <div className="space-y-2">
                  {requiresAttention.map((s) => {
                    const score = s.instructorScore ?? s.aiScore ?? 0;
                    const letter = gradeLetter(score, max);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{s.studentName}</p>
                          <p className={`text-xs ${gradeTextClass(letter)}`}>
                            Score: {score}/{max} ({letter})
                          </p>
                        </div>
                        <Link
                          href={`/courses/${id}/assignments/${assignmentId}/recheck?sub=${s.id}`}
                          className="text-xs text-[var(--accent)] font-medium hover:underline shrink-0"
                        >
                          View
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top performer */}
            {topPerformer && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Top Performer
                </p>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{topPerformer.studentName}</p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    Score: {topPerformer.instructorScore ?? topPerformer.aiScore}/{max} (A+)
                  </p>
                </div>
              </div>
            )}

            {/* AI Feedback */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Provide AI Feedback
              </p>
              <div className="flex justify-center mb-3">
                <StarRating value={starRating} onChange={setStarRating} />
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                placeholder="Share your feedback on the AI grading quality..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors text-[var(--text-primary)] placeholder:text-gray-300"
              />
              <button
                onClick={() => { setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000); }}
                className="w-full mt-3 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#0E7490] text-white text-xs font-semibold transition-colors"
              >
                {feedbackSent ? "✓ Sent!" : "Feedback Grading"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
