"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECENT_ASSIGNMENTS = [
  { id: "a1", course: "Advanced Mathematics 101", assignment: "Calculus Mid-Term", status: "Not Graded", dueDate: "Oct 24, 2023" },
  { id: "a2", course: "Physics for Engineers", assignment: "Lab Report: Motion", status: "All Graded", dueDate: "Oct 22, 2023" },
  { id: "a3", course: "World History", assignment: "Essay: Industrial Revolution", status: "Late (2)", dueDate: "Oct 26, 2023" },
];

const DEADLINES = [
  { month: "OCT", day: "25", title: "Literature Review", sub: "English 101 • 11:59 PM", color: "bg-orange-500" },
  { month: "OCT", day: "28", title: "Final Project Proposal", sub: "Computer Science • 5:00 PM", color: "bg-[#0F766E]" },
  { month: "NOV", day: "02", title: "Mid-term Exam", sub: "Chemistry Lab • 9:00 AM", color: "bg-[#1B2A4A]" },
];

const PERF_DATA = [65, 68, 72, 75, 80, 88];
const PERF_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];

const USAGE_DATA_GRADING = [0, 120, 80, 200, 150, 0, 0, 300, 250, 180, 0, 0, 400, 320, 280, 350, 0, 0, 200, 150, 100, 0, 0, 280, 320, 0, 0, 150, 200, 180];
const USAGE_DATA_PLAGIARISM = [0, 40, 30, 60, 50, 0, 0, 80, 70, 50, 0, 0, 100, 90, 80, 95, 0, 0, 60, 40, 30, 0, 0, 75, 85, 0, 0, 40, 55, 50];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    "Not Graded": "bg-red-100 text-red-600",
    "All Graded": "bg-green-100 text-green-700",
  };
  const base = cfg[status] ?? "bg-orange-100 text-orange-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${base}`}>
      {status}
    </span>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineChart({ data, labels, color = "#0F766E" }: { data: number[]; labels: string[]; color?: string }) {
  const W = 480; const H = 160;
  const pad = { t: 16, b: 28, l: 30, r: 16 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const min = 0; const max = 100;

  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * cw,
    y: pad.t + (1 - (v - min) / (max - min)) * ch,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x},${pad.t + ch} L${pts[0].x},${pad.t + ch}Z`;

  const gridVals = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      {/* Grid */}
      {gridVals.map((v) => {
        const y = pad.t + (1 - v / 100) * ch;
        return (
          <g key={v}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#F1F5F9" strokeWidth="1" />
            <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#CBD5E1">{v}</text>
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((l, i) => {
        const x = pad.l + (i / (labels.length - 1)) * cw;
        return <text key={l} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#CBD5E1">{l}</text>;
      })}
      {/* Dashed class average line */}
      <line x1={pad.l} y1={pad.t + (1 - 0.8) * ch} x2={W - pad.r} y2={pad.t + (1 - 0.8) * ch}
        stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - pad.r + 2} y={pad.t + (1 - 0.8) * ch + 4} fontSize="8" fill="#CBD5E1">Class Average</text>
      {/* Area */}
      <path d={area} fill={color} fillOpacity="0.08" />
      {/* Line */}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

// ─── Usage bar chart ──────────────────────────────────────────────────────────

function UsageChart({ grading, plagiarism }: { grading: number[]; plagiarism: number[] }) {
  const W = 900; const H = 160;
  const pad = { t: 12, b: 28, l: 8, r: 8 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const maxVal = Math.max(...grading, ...plagiarism, 1);
  const barW = (cw / grading.length) * 0.4;
  const gap = (cw / grading.length) * 0.6;

  const xLabels = ["01", "05", "10", "15", "20", "25", "30"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      {grading.map((g, i) => {
        const x = pad.l + i * (cw / grading.length);
        const gH = (g / maxVal) * ch;
        const pH = (plagiarism[i] / maxVal) * ch;
        return (
          <g key={i}>
            <rect x={x + gap / 2} y={pad.t + ch - gH} width={barW} height={gH} rx="2" fill="#2DD4BF" fillOpacity="0.8" />
            <rect x={x + gap / 2 + barW + 1} y={pad.t + ch - pH} width={barW * 0.7} height={pH} rx="2" fill="#CBD5E1" />
          </g>
        );
      })}
      {/* X axis labels */}
      {xLabels.map((l, i) => {
        const x = pad.l + Math.round((parseInt(l) - 1) / (grading.length - 1) * cw);
        return <text key={l} x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="#CBD5E1">{l}</text>;
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [perfPeriod, setPerfPeriod] = useState<"This Semester" | "Last Semester" | "This Month">("This Semester");
  const [usagePeriod, setUsagePeriod] = useState<"This Month" | "Last 30 Days" | "Last Quarter">("This Month");

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <Navbar />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Dashboard Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Welcome back, check your grading status, credits used and AI usage history from here</p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Total Assignments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400">Total Assignments</p>
              <div className="w-8 h-8 rounded-lg bg-[#E6FAF8] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#1B2A4A]">54</p>
            <p className="text-xs text-green-600 mt-1.5 flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              12% from last semester
            </p>
          </div>

          {/* Pending Grades */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400">Pending Grades</p>
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#1B2A4A]">48</p>
            <p className="text-xs text-red-500 mt-1.5 font-medium">! Urgent needs attention</p>
          </div>

          {/* Avg. Class Score */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400">Avg. Class Score</p>
              <div className="w-8 h-8 rounded-lg bg-[#E6FAF8] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#1B2A4A]">84.2%</p>
            <p className="text-xs text-green-600 mt-1.5 flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              2.4% improvement
            </p>
          </div>

          {/* AI Credits */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-400">AI Credits</p>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#1B2A4A]">1,200</p>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: "70%" }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">70% remaining for this month</p>
            </div>
          </div>
        </div>

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-[1fr_280px] gap-5 mb-5">

          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Recent Assignments */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-gray-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <h2 className="text-sm font-bold text-[#1B2A4A]">Recent Assignments</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                    <th className="px-6 py-2.5">Course Name</th>
                    <th className="px-4 py-2.5">Assignment</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Due Date</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {RECENT_ASSIGNMENTS.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-medium text-[#1B2A4A] text-xs leading-snug">{a.course}</td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">{a.assignment}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{a.dueDate}</td>
                      <td className="px-4 py-3.5">
                        <Link href="/courses" className="text-xs text-[#0F766E] font-medium hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Class Performance chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1B2A4A] flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  Class Performance
                </h2>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {(["This Semester", "Last Semester", "This Month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPerfPeriod(p)}
                      className={[
                        "px-3 py-1.5 font-medium transition-colors",
                        perfPeriod === p ? "bg-[#1B2A4A] text-white" : "text-gray-400 hover:text-gray-600",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <LineChart data={PERF_DATA} labels={PERF_LABELS} />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-[#1B2A4A] mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Add Course", href: "/courses/new", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
                  { label: "Go to Courses", href: "/courses", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
                  { label: "View Setting", href: "/settings", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9"/></svg>, bgClass: "bg-[#E6FAF8]" },
                  { label: "Logout", href: "/", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, bgClass: "bg-red-50" },
                ].map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl ${a.bgClass ?? "bg-[#E6FAF8]"} hover:opacity-80 transition-opacity`}
                  >
                    {a.icon}
                    <span className="text-xs font-medium text-[#1B2A4A] text-center leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-[#1B2A4A] mb-4">Upcoming Deadlines</h2>
              <div className="flex flex-col gap-3">
                {DEADLINES.map((d) => (
                  <div key={d.title} className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${d.color} flex flex-col items-center justify-center shrink-0`}>
                      <span className="text-white text-[9px] font-bold uppercase leading-none">{d.month}</span>
                      <span className="text-white text-base font-extrabold leading-none">{d.day}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1B2A4A] leading-snug">{d.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Platforms */}
            <div className="bg-[#1B2A4A] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                  <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                </svg>
                Sync Platforms
              </h2>
              {["Google Classroom", "Microsoft Teams"].map((p) => (
                <button
                  key={p}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors mb-2 last:mb-0"
                >
                  <span className="text-white text-sm font-medium">{p}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom stats ── */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <p className="text-xs text-gray-400">Total Credits Used</p>
            </div>
            <p className="text-4xl font-extrabold text-[#1B2A4A]">3,750 <span className="text-base font-normal text-gray-300">/ 5,000</span></p>
            <p className="text-xs text-green-600 mt-2">↗ 12% more than last month</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <p className="text-xs text-gray-400">Assignments Graded</p>
            </div>
            <p className="text-4xl font-extrabold text-[#1B2A4A]">248 <span className="text-base font-normal text-gray-300">papers</span></p>
            <p className="text-xs text-gray-400 mt-2">Avg. 15 credits per paper</p>
          </div>
        </div>

        {/* ── AI Usage History ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-xl font-extrabold text-[#1B2A4A]">AI Usage History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Track your grading activity and credit consumption.</p>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(["This Month", "Last 30 Days", "Last Quarter"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setUsagePeriod(p)}
                  className={[
                    "px-3 py-1.5 font-medium transition-colors",
                    usagePeriod === p ? "bg-[#2DD4BF] text-[#1B2A4A]" : "text-gray-400 hover:text-gray-600",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#1B2A4A]">Daily Credit Consumption</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-[#2DD4BF] inline-block" /> Auto-Grading</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-gray-300 inline-block" /> Plagiarism Check</span>
            </div>
          </div>
          <UsageChart grading={USAGE_DATA_GRADING} plagiarism={USAGE_DATA_PLAGIARISM} />
        </div>
      </main>
    </div>
  );
}
