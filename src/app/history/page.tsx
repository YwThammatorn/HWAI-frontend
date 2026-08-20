"use client";

import { useState, useMemo } from "react";
import AppShell from "@/components/AppShell";

// ─── Types & Seed Data ────────────────────────────────────────────────────────

type GradingStatus = "completed" | "failed";

interface GradingSession {
  id: string;
  date: string; // ISO datetime
  assignmentId: string;
  assignment: string;
  courseId: string;
  course: string;
  courseColor: string;
  count: number;   // number of papers graded
  cost: number;    // credits used
  status: GradingStatus;
  grader: string;  // name or "You"
}

const HISTORY: GradingSession[] = [
  { id: "h-1",  date: "2026-08-20T11:30:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 5,  cost: 75,  status: "completed", grader: "You" },
  { id: "h-2",  date: "2026-08-18T09:15:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 4,  cost: 60,  status: "completed", grader: "You" },
  { id: "h-3",  date: "2026-08-15T14:00:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 4,  cost: 60,  status: "completed", grader: "You" },
  { id: "h-4",  date: "2026-08-12T16:45:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 3,  cost: 45,  status: "failed",    grader: "You" },
  { id: "h-5",  date: "2026-08-10T10:20:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 5,  cost: 75,  status: "completed", grader: "You" },
  { id: "h-6",  date: "2026-08-07T08:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 10, cost: 150, status: "completed", grader: "You" },
  { id: "h-7",  date: "2026-08-05T13:30:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 8,  cost: 120, status: "completed", grader: "You" },
  { id: "h-8",  date: "2026-08-03T11:00:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 12, cost: 180, status: "completed", grader: "You" },
  { id: "h-9",  date: "2026-07-30T09:45:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 15, cost: 225, status: "completed", grader: "You" },
  { id: "h-10", date: "2026-07-28T15:20:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 7,  cost: 105, status: "failed",    grader: "You" },
  { id: "h-11", date: "2026-07-25T10:00:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 9,  cost: 135, status: "completed", grader: "You" },
  { id: "h-12", date: "2026-07-22T14:15:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 6,  cost: 90,  status: "completed", grader: "You" },
  { id: "h-13", date: "2026-07-20T08:30:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 20, cost: 300, status: "completed", grader: "You" },
  { id: "h-14", date: "2026-07-17T11:45:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 14, cost: 210, status: "completed", grader: "You" },
  { id: "h-15", date: "2026-07-15T09:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 11, cost: 165, status: "completed", grader: "You" },
  { id: "h-16", date: "2026-07-12T13:00:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 18, cost: 270, status: "completed", grader: "You" },
  { id: "h-17", date: "2026-07-10T10:30:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 9,  cost: 135, status: "completed", grader: "You" },
  { id: "h-18", date: "2026-07-08T15:00:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 22, cost: 330, status: "failed",    grader: "You" },
  { id: "h-19", date: "2026-07-05T09:30:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "#A78BFA", count: 16, cost: 240, status: "completed", grader: "You" },
  { id: "h-20", date: "2026-07-02T14:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "#2DD4BF", count: 13, cost: 195, status: "completed", grader: "You" },
];

const TOTAL_CREDIT_LIMIT = 5000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function exportCSV(sessions: GradingSession[]) {
  const header = "Date,Time,Assignment,Course,Papers,Credits,Status,Grader\n";
  const rows = sessions.map((s) =>
    [formatDate(s.date), formatTime(s.date), `"${s.assignment}"`, `"${s.course}"`, s.count, s.cost, s.status, s.grader].join(",")
  );
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grading-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Credit Ring SVG ──────────────────────────────────────────────────────────

function CreditRing({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke="#2DD4BF" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
        {pct}%
      </text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PER_PAGE = 8;

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GradingStatus>("all");
  const [page, setPage] = useState(1);

  // ── Stats (from all data, not filtered) ──────────────────────────────────
  const totalCreditsUsed = HISTORY.reduce((s, h) => s + (h.status === "completed" ? h.cost : 0), 0);
  const totalPapersGraded = HISTORY.reduce((s, h) => s + (h.status === "completed" ? h.count : 0), 0);
  const totalSessions = HISTORY.filter((h) => h.status === "completed").length;
  const avgCostPerPaper = totalSessions > 0
    ? Math.round(totalCreditsUsed / totalPapersGraded)
    : 0;
  const remaining = TOTAL_CREDIT_LIMIT - totalCreditsUsed;
  const usedPct = Math.round((totalCreditsUsed / TOTAL_CREDIT_LIMIT) * 100);
  const remainingPct = 100 - usedPct;

  // ── Filtered & paginated ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return HISTORY.filter((h) => {
      const matchSearch = !q || h.assignment.toLowerCase().includes(q) || h.course.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || h.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safeePage = Math.min(page, totalPages);
  const visible = filtered.slice((safeePage - 1) * PER_PAGE, safeePage * PER_PAGE);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleStatusFilter(val: "all" | GradingStatus) {
    setStatusFilter(val);
    setPage(1);
  }

  const pageNums: (number | "...")[] = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safeePage <= 3) return [1, 2, 3, "...", totalPages];
    if (safeePage >= totalPages - 2) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", safeePage - 1, safeePage, safeePage + 1, "...", totalPages];
  })();

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-8 py-8 w-full">
        {/* ── Page Title ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Grading History</h1>
          <p className="text-sm text-gray-500 mt-1">Track your grading activity and credit consumption.</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Credits Used */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-[#0F766E] mb-3">
              <IconBolt />
              <span className="text-xs font-semibold tracking-wide uppercase text-gray-500">Total Credits Used</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[#1B2A4A] tabular-nums">{totalCreditsUsed.toLocaleString()}</span>
              <span className="text-sm text-gray-400 mb-1">/ {TOTAL_CREDIT_LIMIT.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[#0F766E] mt-2 font-medium">↑ {usedPct}% of total limit used</p>
          </div>

          {/* Assignments Graded */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <IconCheck />
              <span className="text-xs font-semibold tracking-wide uppercase text-gray-500">Assignments Graded</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-[#1B2A4A] tabular-nums">{totalPapersGraded}</span>
              <span className="text-sm text-gray-400 mb-1">papers</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Avg. {avgCostPerPaper} credits per paper</p>
          </div>

          {/* Remaining Balance — dark card */}
          <div className="bg-[#1B2A4A] rounded-2xl shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Remaining Balance</p>
                <span className="text-3xl font-bold text-white tabular-nums">{remaining.toLocaleString()}</span>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-[140px]">
                  {remainingPct < 30
                    ? "You are running low on credits for upcoming assignments."
                    : "You have enough credits for upcoming assignments."}
                </p>
              </div>
              <CreditRing pct={remainingPct} />
            </div>
            <button className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#2DD4BF] text-[#1B2A4A] text-sm font-semibold hover:bg-[#14B8A6] transition-colors">
              <IconPlus />
              Buy Credits
            </button>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header / controls */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
            <h2 className="text-base font-bold text-[#1B2A4A]">Detailed Grading Log</h2>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="Search activity..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] w-48"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value as typeof statusFilter)}
                className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              {/* Export */}
              <button
                onClick={() => exportCSV(filtered)}
                title="Export CSV"
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-[#1B2A4A] hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <IconDownload />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-5 py-3 whitespace-nowrap">Date & Time</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Assignment</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Course</th>
                  <th className="text-right text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Count</th>
                  <th className="text-right text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Cost</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Status</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 px-4 py-3">Grader</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                      No grading sessions match your search.
                    </td>
                  </tr>
                ) : (
                  visible.map((session) => (
                    <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-sm font-medium text-[#1B2A4A]">{formatDate(session.date)}</p>
                        <p className="text-xs text-gray-400">{formatTime(session.date)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-[#1B2A4A] leading-snug max-w-[200px]">{session.assignment}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: session.courseColor }}
                          />
                          <span className="text-sm text-gray-700">{session.course}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className="text-sm font-medium text-[#1B2A4A]">{session.count}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className={`text-sm font-medium ${session.status === "failed" ? "text-gray-400" : "text-red-500"}`}>
                          {session.status === "failed" ? "—" : `-${session.cost} Cr`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {session.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium text-[#0F766E]">{session.grader}</span>
                      </td>
                      <td className="px-3 py-3.5 text-gray-300">
                        <IconChevronRight />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {filtered.length === 0 ? 0 : (safeePage - 1) * PER_PAGE + 1}–{Math.min(safeePage * PER_PAGE, filtered.length)} of {filtered.length} results
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safeePage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹
              </button>
              {pageNums.map((n, i) =>
                n === "..." ? (
                  <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={[
                      "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors",
                      n === safeePage
                        ? "bg-[#2DD4BF] text-[#1B2A4A] font-semibold"
                        : "text-gray-500 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeePage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
