"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { TEACHER_HISTORY_DISABLED } from "@/lib/featureFlags";
import SearchInput from "@/components/SearchInput";

import Icon from "@/components/Icon";
import Pagination from "@/components/Pagination";
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
  { id: "h-1",  date: "2026-08-20T11:30:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 5,  cost: 75,  status: "completed", grader: "You" },
  { id: "h-2",  date: "2026-08-18T09:15:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 4,  cost: 60,  status: "completed", grader: "You" },
  { id: "h-3",  date: "2026-08-15T14:00:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 4,  cost: 60,  status: "completed", grader: "You" },
  { id: "h-4",  date: "2026-08-12T16:45:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 3,  cost: 45,  status: "failed",    grader: "You" },
  { id: "h-5",  date: "2026-08-10T10:20:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 5,  cost: 75,  status: "completed", grader: "You" },
  { id: "h-6",  date: "2026-08-07T08:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 10, cost: 150, status: "completed", grader: "You" },
  { id: "h-7",  date: "2026-08-05T13:30:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 8,  cost: 120, status: "completed", grader: "You" },
  { id: "h-8",  date: "2026-08-03T11:00:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 12, cost: 180, status: "completed", grader: "You" },
  { id: "h-9",  date: "2026-07-30T09:45:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 15, cost: 225, status: "completed", grader: "You" },
  { id: "h-10", date: "2026-07-28T15:20:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 7,  cost: 105, status: "failed",    grader: "You" },
  { id: "h-11", date: "2026-07-25T10:00:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 9,  cost: 135, status: "completed", grader: "You" },
  { id: "h-12", date: "2026-07-22T14:15:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 6,  cost: 90,  status: "completed", grader: "You" },
  { id: "h-13", date: "2026-07-20T08:30:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 20, cost: 300, status: "completed", grader: "You" },
  { id: "h-14", date: "2026-07-17T11:45:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 14, cost: 210, status: "completed", grader: "You" },
  { id: "h-15", date: "2026-07-15T09:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 11, cost: 165, status: "completed", grader: "You" },
  { id: "h-16", date: "2026-07-12T13:00:00Z", assignmentId: "a-seed-1-3", assignment: "Final UI Design (Figma)",   courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 18, cost: 270, status: "completed", grader: "You" },
  { id: "h-17", date: "2026-07-10T10:30:00Z", assignmentId: "a-seed-2-2", assignment: "Usability Test Report",      courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 9,  cost: 135, status: "completed", grader: "You" },
  { id: "h-18", date: "2026-07-08T15:00:00Z", assignmentId: "a-seed-1-2", assignment: "Wireframe Prototype",        courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 22, cost: 330, status: "failed",    grader: "You" },
  { id: "h-19", date: "2026-07-05T09:30:00Z", assignmentId: "a-seed-2-1", assignment: "Interaction Flow Diagram",   courseId: "seed-2", course: "Interaction Design",  courseColor: "var(--role-ta-text)", count: 16, cost: 240, status: "completed", grader: "You" },
  { id: "h-20", date: "2026-07-02T14:00:00Z", assignmentId: "a-seed-1-1", assignment: "User Research Report",       courseId: "seed-1", course: "UX/UI Design",        courseColor: "var(--brand-bright)", count: 13, cost: 195, status: "completed", grader: "You" },
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
    <Icon name="zap" />
  );
}

function IconCheck() {
  return (
    <Icon name="check-square" />
  );
}

function IconDownload() {
  return (
    <Icon name="download" />
  );
}

function IconChevronRight() {
  return (
    <Icon name="chevron-right" size="sm" />
  );
}

function IconPlus() {
  return (
    <Icon name="plus" size="sm" />
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
        stroke="var(--accent-bright)" strokeWidth="5"
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
  const { t } = useLanguage();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GradingStatus>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (TEACHER_HISTORY_DISABLED) router.replace("/teacher/courses");
  }, [router]);

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

  if (TEACHER_HISTORY_DISABLED) return null;

  return (
      <main className="w-full px-8 py-8">
        {/* ── Page Title ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("ประวัติการตรวจงาน", "Grading History")}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t("ติดตามกิจกรรมการตรวจและการใช้ credit", "Track your grading activity and credit consumption.")}</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Credits Used */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-center gap-2 text-[var(--accent)] mb-3">
              <IconBolt />
              <span className="text-xs font-semibold tracking-wide uppercase text-[var(--text-secondary)]">{t("Credit ที่ใช้ไปทั้งหมด", "Total Credits Used")}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{totalCreditsUsed.toLocaleString()}</span>
              <span className="text-sm text-[var(--text-muted)] mb-1">/ {TOTAL_CREDIT_LIMIT.toLocaleString()}</span>
            </div>
            <p className="text-xs text-[var(--accent)] mt-2 font-medium">↑ {usedPct}% {t("ของ credit ทั้งหมดที่ใช้ไป", "of total limit used")}</p>
          </div>

          {/* Assignments Graded */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <IconCheck />
              <span className="text-xs font-semibold tracking-wide uppercase text-[var(--text-secondary)]">{t("งานที่ตรวจแล้ว", "Assignments Graded")}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{totalPapersGraded}</span>
              <span className="text-sm text-[var(--text-muted)] mb-1">{t("ชิ้นงาน", "papers")}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{t("เฉลี่ย", "Avg.")} {avgCostPerPaper} {t("credit ต่อชิ้นงาน", "credits per paper")}</p>
          </div>

          {/* Remaining Balance — dark card */}
          <div className="bg-[var(--bg-nav)] rounded-2xl shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">{t("ยอด Credit คงเหลือ", "Remaining Balance")}</p>
                <span className="text-2xl font-bold text-white tabular-nums">{remaining.toLocaleString()}</span>
                <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed max-w-[140px]">
                  {remainingPct < 30
                    ? t("Credit ใกล้หมดแล้ว กรุณาเติมก่อนตรวจงาน", "You are running low on credits for upcoming assignments.")
                    : t("มี Credit เพียงพอสำหรับการตรวจงาน", "You have enough credits for upcoming assignments.")}
                </p>
              </div>
              <CreditRing pct={remainingPct} />
            </div>
            <button className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors">
              <IconPlus />
              {t("เติม Credit", "Buy Credits")}
            </button>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          {/* Table header / controls */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] flex-wrap gap-3">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("บันทึกการตรวจงาน", "Detailed Grading Log")}</h2>
            <div className="flex items-center gap-2">
              {/* Search */}
              <SearchInput
                value={search}
                onChange={handleSearch}
                placeholder={t("ค้นหา...", "Search activity...")}
                suggestions={[...new Set(HISTORY.map((h) => h.assignment))]}
                className="w-48"
              />

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value as typeof statusFilter)}
                className="text-xs px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]/40 cursor-pointer"
              >
                <option value="all">{t("ทุกสถานะ", "All Status")}</option>
                <option value="completed">{t("สำเร็จ", "Completed")}</option>
                <option value="failed">{t("ล้มเหลว", "Failed")}</option>
              </select>

              {/* Export */}
              <button
                onClick={() => exportCSV(filtered)}
                title="Export CSV"
                className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <IconDownload />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-5 py-3 whitespace-nowrap">{t("วันที่ & เวลา", "Date & Time")}</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("ชิ้นงาน", "Assignment")}</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("รายวิชา", "Course")}</th>
                  <th className="text-right text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("จำนวน", "Count")}</th>
                  <th className="text-right text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("ค่าใช้จ่าย", "Cost")}</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("สถานะ", "Status")}</th>
                  <th className="text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 py-3">{t("ผู้ตรวจ", "Grader")}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-[var(--text-muted)]">
                      {t("ไม่พบประวัติการตรวจที่ตรงกัน", "No grading sessions match your search.")}
                    </td>
                  </tr>
                ) : (
                  visible.map((session) => (
                    <tr key={session.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{formatDate(session.date)}</p>
                        <p className="text-xs text-[var(--text-muted)]">{formatTime(session.date)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug max-w-[200px]">{session.assignment}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: session.courseColor }}
                          />
                          <span className="text-sm text-[var(--text-primary)]">{session.course}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{session.count}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className={`text-sm font-medium ${session.status === "failed" ? "text-[var(--text-muted)]" : "text-[var(--s-err-text)]"}`}>
                          {session.status === "failed" ? "—" : `-${session.cost} Cr`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {session.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--s-ok-text)]" />
                            {t("สำเร็จ", "Completed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--s-err-bg)] text-[var(--s-err-text)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--s-err-text)]" />
                            {t("ล้มเหลว", "Failed")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-medium text-[var(--accent)]">{session.grader}</span>
                      </td>
                      <td className="px-3 py-3.5 text-[var(--text-muted)]">
                        <IconChevronRight />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-muted)]">
              {t("แสดง", "Showing")} {filtered.length === 0 ? 0 : (safeePage - 1) * PER_PAGE + 1}–{Math.min(safeePage * PER_PAGE, filtered.length)} {t("จาก", "of")} {filtered.length} {t("รายการ", "results")}
            </p>
            <Pagination page={safeePage} totalPages={totalPages} onChange={setPage} className="" />
          </div>
        </div>
      </main>
  );
}
