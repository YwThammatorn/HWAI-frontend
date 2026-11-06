"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { TEACHER_DASHBOARD_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
// ─── Mock data ────────────────────────────────────────────────────────────────

const RECENT_ASSIGNMENTS = [
  { id: "a1", course: "Advanced Mathematics 101", assignment: "Calculus Mid-Term", status: "Not Graded", dueDate: "Oct 24, 2023" },
  { id: "a2", course: "Physics for Engineers", assignment: "Lab Report: Motion", status: "All Graded", dueDate: "Oct 22, 2023" },
  { id: "a3", course: "World History", assignment: "Essay: Industrial Revolution", status: "Late (2)", dueDate: "Oct 26, 2023" },
];

const DEADLINES = [
  { month: "OCT", day: "25", title: "Literature Review", sub: "English 101 • 11:59 PM", color: "bg-[var(--st-todo-text)]" },
  { month: "OCT", day: "28", title: "Final Project Proposal", sub: "Computer Science • 5:00 PM", color: "bg-[var(--accent)]" },
  { month: "NOV", day: "02", title: "Mid-term Exam", sub: "Chemistry Lab • 9:00 AM", color: "bg-[var(--bg-nav)]" },
];

const PERF_DATA = [65, 68, 72, 75, 80, 88];
const PERF_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];

const USAGE_DATA_GRADING = [0, 120, 80, 200, 150, 0, 0, 300, 250, 180, 0, 0, 400, 320, 280, 350, 0, 0, 200, 150, 100, 0, 0, 280, 320, 0, 0, 150, 200, 180];
const USAGE_DATA_PLAGIARISM = [0, 40, 30, 60, 50, 0, 0, 80, 70, 50, 0, 0, 100, 90, 80, 95, 0, 0, 60, 40, 30, 0, 0, 75, 85, 0, 0, 40, 55, 50];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const cfg: Record<string, { cls: string; label: string }> = {
    "Not Graded": { cls: "bg-[var(--s-err-bg)] text-[var(--s-err-text)]",    label: t("ยังไม่ตรวจ", "Not Graded") },
    "All Graded": { cls: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]", label: t("ตรวจแล้ว", "All Graded") },
  };
  const item = cfg[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${item?.cls ?? "bg-[var(--st-todo-bg)] text-[var(--st-todo-text)]"}`}>
      {item?.label ?? status}
    </span>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineChart({ data, labels, color = "var(--accent)" }: { data: number[]; labels: string[]; color?: string }) {
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
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="var(--border)">{v}</text>
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((l, i) => {
        const x = pad.l + (i / (labels.length - 1)) * cw;
        return <text key={l} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--border)">{l}</text>;
      })}
      {/* Dashed class average line */}
      <line x1={pad.l} y1={pad.t + (1 - 0.8) * ch} x2={W - pad.r} y2={pad.t + (1 - 0.8) * ch}
        stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - pad.r + 2} y={pad.t + (1 - 0.8) * ch + 4} fontSize="8" fill="var(--border)">Class Average</text>
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
            <rect x={x + gap / 2} y={pad.t + ch - gH} width={barW} height={gH} rx="2" fill="var(--accent-bright)" fillOpacity="0.8" />
            <rect x={x + gap / 2 + barW + 1} y={pad.t + ch - pH} width={barW * 0.7} height={pH} rx="2" fill="var(--border)" />
          </g>
        );
      })}
      {/* X axis labels */}
      {xLabels.map((l, i) => {
        const x = pad.l + Math.round((parseInt(l) - 1) / (grading.length - 1) * cw);
        return <text key={l} x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--border)">{l}</text>;
      })}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PerfPeriod = "this_semester" | "last_semester" | "this_month";
type UsagePeriod = "this_month" | "last_30_days" | "last_quarter";

export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>("this_semester");
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>("this_month");

  useEffect(() => {
    if (TEACHER_DASHBOARD_DISABLED) router.replace("/teacher/courses");
  }, [router]);

  if (TEACHER_DASHBOARD_DISABLED) return null;

  const PERF_PERIODS: { key: PerfPeriod; label: string }[] = [
    { key: "this_semester",  label: t("ภาคนี้", "This Semester") },
    { key: "last_semester",  label: t("ภาคที่แล้ว", "Last Semester") },
    { key: "this_month",     label: t("เดือนนี้", "This Month") },
  ];
  const USAGE_PERIODS: { key: UsagePeriod; label: string }[] = [
    { key: "this_month",   label: t("เดือนนี้", "This Month") },
    { key: "last_30_days", label: t("30 วันที่แล้ว", "Last 30 Days") },
    { key: "last_quarter", label: t("ไตรมาสที่แล้ว", "Last Quarter") },
  ];
  const QUICK_ACTIONS = [
    { label: t("ไปที่รายวิชา", "Go to Courses"), href: "/teacher/courses",     bgClass: "bg-[var(--accent-subtle)]", icon: <Icon name="graduation-cap" size="lg" className="text-[var(--accent)]" /> },
    { label: t("ออกจากระบบ", "Logout"),           href: "/",           bgClass: "bg-[var(--s-err-bg)]",                 icon: <Icon name="log-out" size="lg" className="text-[var(--s-err-text)]" /> },
  ];

  return (
      <main className="w-full px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t("ภาพรวมระบบ", "Dashboard Overview")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("ยินดีต้อนรับ — ตรวจสอบสถานะการตรวจงาน เครดิต และประวัติการใช้ AI ได้ที่นี่", "Welcome back, check your grading status, credits used and AI usage history from here")}
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Total Assignments */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-secondary)]">{t("งานทั้งหมด", "Total Assignments")}</p>
              <IconTile icon="users" size="sm" tone="accent" />
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">54</p>
            <p className="text-xs text-[var(--s-ok-text)] mt-1.5 flex items-center gap-0.5">
              <Icon name="chevron-up" size="xs" />
              {t("12% จากภาคที่แล้ว", "12% from last semester")}
            </p>
          </div>

          {/* Pending Grades */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-secondary)]">{t("รอตรวจ", "Pending Grades")}</p>
              <IconTile icon="file-plus" size="sm" tone="err" />
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">48</p>
            <p className="text-xs text-[var(--s-err-text)] mt-1.5 font-medium">{t("! ต้องดำเนินการด่วน", "! Urgent needs attention")}</p>
          </div>

          {/* Avg. Class Score */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-secondary)]">{t("คะแนนเฉลี่ยชั้นเรียน", "Avg. Class Score")}</p>
              <IconTile icon="activity" size="sm" tone="accent" />
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">84.2%</p>
            <p className="text-xs text-[var(--s-ok-text)] mt-1.5 flex items-center gap-0.5">
              <Icon name="chevron-up" size="xs" />
              {t("ปรับปรุง 2.4%", "2.4% improvement")}
            </p>
          </div>

          {/* AI Credits */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-[var(--text-secondary)]">{t("เครดิต AI", "AI Credits")}</p>
              <IconTile icon="zap" size="sm" tone="ta" />
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">1,200</p>
            <div className="mt-2">
              <div className="h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--role-ta-bg)] rounded-full" style={{ width: "70%" }} />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t("เหลือ 70% สำหรับเดือนนี้", "70% remaining for this month")}</p>
            </div>
          </div>
        </div>

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-[1fr_280px] gap-5 mb-5">

          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Recent Assignments */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
                <Icon name="file" className="text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("งานล่าสุด", "Recent Assignments")}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    <th className="px-6 py-2.5">{t("ชื่อวิชา", "Course Name")}</th>
                    <th className="px-4 py-2.5">{t("งาน", "Assignment")}</th>
                    <th className="px-4 py-2.5">{t("สถานะ", "Status")}</th>
                    <th className="px-4 py-2.5">{t("กำหนดส่ง", "Due Date")}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {RECENT_ASSIGNMENTS.map((a) => (
                    <tr key={a.id} className="hover:bg-[var(--bg-subtle)]/50">
                      <td className="px-6 py-3.5 font-medium text-[var(--text-primary)] text-xs leading-snug">{a.course}</td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs">{a.assignment}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">{a.dueDate}</td>
                      <td className="px-4 py-3.5">
                        <Link href="/teacher/courses" className="text-xs text-[var(--accent)] font-medium hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Class Performance chart */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Icon name="bar-chart" className="text-[var(--accent)]" />
                  {t("ผลการเรียนชั้นเรียน", "Class Performance")}
                </h2>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
                  {PERF_PERIODS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPerfPeriod(key)}
                      className={[
                        "px-3 py-1.5 font-medium transition-colors",
                        perfPeriod === key ? "bg-[var(--bg-nav)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-secondary)]",
                      ].join(" ")}
                    >
                      {label}
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
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t("ทำได้เลย", "Quick Actions")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl ${a.bgClass} hover:opacity-80 transition-opacity`}
                  >
                    {a.icon}
                    <span className="text-xs font-medium text-[var(--text-primary)] text-center leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t("กำหนดส่งที่กำลังมาถึง", "Upcoming Deadlines")}</h2>
              <div className="flex flex-col gap-3">
                {DEADLINES.map((d) => (
                  <div key={d.title} className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${d.color} flex flex-col items-center justify-center shrink-0`}>
                      <span className="text-white text-[9px] font-bold uppercase leading-none">{d.month}</span>
                      <span className="text-white text-base font-extrabold leading-none">{d.day}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{d.title}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{d.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Platforms */}
            <div className="bg-[var(--bg-nav)] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Icon name="maximize" size="sm" className="text-[var(--accent-bright)]" />
                {t("เชื่อมต่อแพลตฟอร์ม", "Sync Platforms")}
              </h2>
              {["Google Classroom", "Microsoft Teams"].map((p) => (
                <button
                  key={p}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors mb-2 last:mb-0"
                >
                  <span className="text-white text-sm font-medium">{p}</span>
                  <Icon name="external-link" size="xs" className="text-white" opacity="0.6" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom stats ── */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="zap" size="sm" className="text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-secondary)]">{t("เครดิตที่ใช้ทั้งหมด", "Total Credits Used")}</p>
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">3,750 <span className="text-base font-normal text-[var(--text-muted)]">/ 5,000</span></p>
            <p className="text-xs text-[var(--s-ok-text)] mt-2">{t("↗ 12% มากกว่าเดือนที่แล้ว", "↗ 12% more than last month")}</p>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="check-square" size="sm" className="text-[var(--accent)]" />
              <p className="text-xs text-[var(--text-secondary)]">{t("งานที่ตรวจแล้ว", "Assignments Graded")}</p>
            </div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">248 <span className="text-base font-normal text-[var(--text-muted)]">{t("งาน", "papers")}</span></p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">{t("เฉลี่ย 15 เครดิตต่อกระดาษ", "Avg. 15 credits per paper")}</p>
          </div>
        </div>

        {/* ── AI Usage History ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-primary)]">{t("ประวัติการใช้ AI", "AI Usage History")}</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t("ติดตามกิจกรรมการตรวจงานและการใช้เครดิต", "Track your grading activity and credit consumption.")}</p>
            </div>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
              {USAGE_PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setUsagePeriod(key)}
                  className={[
                    "px-3 py-1.5 font-medium transition-colors",
                    usagePeriod === key ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]" : "text-[var(--text-secondary)] hover:text-[var(--text-secondary)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("การใช้เครดิตรายวัน", "Daily Credit Consumption")}</p>
            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-[var(--accent-bright)] inline-block" /> {t("ตรวจอัตโนมัติ", "Auto-Grading")}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-[var(--border)] inline-block" /> {t("ตรวจการคัดลอก", "Plagiarism Check")}</span>
            </div>
          </div>
          <UsageChart grading={USAGE_DATA_GRADING} plagiarism={USAGE_DATA_PLAGIARISM} />
        </div>
      </main>
  );
}
