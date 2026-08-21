"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold" style={{ color: color ?? "#1B2A4A" }}>
        {value}{" "}
        <span className="text-sm font-normal text-gray-400">{sub}</span>
      </p>
    </div>
  );
}

function CircleProgress({ pct }: { pct: number }) {
  const [displayPct, setDisplayPct] = useState(0);
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = (displayPct / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setDisplayPct(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#E5E7EB" strokeWidth="12" />
      <circle
        cx="100" cy="100" r={r}
        fill="none" stroke="#0F766E" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.23, 1, 0.32, 1)" }}
      />
      <text
        x="100" y="112"
        textAnchor="middle"
        fill="var(--text-primary, #1B2A4A)"
        fontSize="38"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {Math.round(displayPct)}%
      </text>
    </svg>
  );
}

export default function GradingProgressPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment } = useAssignments();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const submissions = getSubmissionsByAssignment(assignmentId);

  if (!course || !assignment) {
    return (
      <AppShell>
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          ไม่พบข้อมูล —{" "}
          <Link href={`/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้างาน", "Back to assignments")}
          </Link>
        </main>
      </AppShell>
    );
  }

  const total = submissions.length;
  const processed = submissions.filter((s) => s.status === "graded").length;
  const needsReview = submissions.filter((s) => s.status === "need_review").length;
  const scoredSubs = submissions.filter((s) => s.aiScore !== null);
  const avgScore =
    scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.aiScore ?? 0), 0) / scoredSubs.length
      : null;
  const pct = total > 0 ? (processed / total) * 100 : 0;
  const isDone = total > 0 && processed === total;

  return (
    <AppShell>
      <main className="w-full max-w-[1100px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <Link href="/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชา", "Courses")}</Link>
          <span>/</span>
          <Link href={`/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">
            {course.name}
          </Link>
          <span>/</span>
          <Link
            href={`/courses/${id}/assignments/${assignmentId}`}
            className="hover:text-[var(--accent)] transition-colors"
          >
            {assignment.name}
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{t("ตรวจงาน", "Grading")}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{assignment.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>
                Due{" "}
                {new Date(assignment.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}{" "}
                at 11:59 PM
              </span>
              <span className="font-medium text-[var(--accent)]">• {t("ตรวจงาน", "Grading")}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/courses/${id}/assignments/${assignmentId}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {t("แก้ไขงาน", "Edit Assignment")}
            </Link>
            {isDone ? (
              <Link
                href={`/courses/${id}/assignments/${assignmentId}/results`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-sm font-semibold transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                {t("ดูผลลัพธ์", "View Results")}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2DD4BF]/60 text-[var(--text-primary)] text-sm font-semibold select-none">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {t("กำลังตรวจ", "Grading")}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label={t("ตรวจแล้ว", "Processed")}
            value={processed}
            sub={t("เสร็จสิ้น", "completed")}
            color="#059669"
            icon={
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            }
          />
          <StatCard
            label={t("ไฟล์ทั้งหมด", "Total Files")}
            value={total}
            sub={t("ไฟล์ที่ส่ง", "submissions")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            }
          />
          <StatCard
            label={t("รอตรวจสอบ", "Needs Review")}
            value={needsReview}
            sub={t("รอดำเนินการ", "Pending")}
            color="#D97706"
            icon={
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            }
          />
          <StatCard
            label={t("คะแนนเฉลี่ย", "Avg. Score")}
            value={avgScore !== null ? avgScore.toFixed(1) : "—"}
            sub={t("จนถึงขณะนี้", "so far")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
          />
        </div>

        {/* Progress card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            {t("ความคืบหน้า", "Overall Progress")}
          </p>
          <div className="flex flex-col items-center justify-center py-8 gap-6">
            <CircleProgress pct={total > 0 ? pct : 0} />
            <div className="text-center">
              <p className="text-base font-semibold text-[var(--text-primary)]">
                {total === 0
                  ? t("ยังไม่มีการส่งงาน", "No Submissions Yet")
                  : isDone
                  ? t("ตรวจเสร็จแล้ว", "Grading Complete")
                  : t("กำลังวิเคราะห์งาน", "Analyzing Submissions")}
              </p>
              {!isDone && total > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {t("เวลาที่เหลือโดยประมาณ:", "Estimated remaining time:")}{" "}
                  <span className="text-[var(--accent)] font-medium">
                    ~{Math.max(1, Math.round((total - processed) * 0.3))} {t("นาที", "mins")}
                  </span>
                </p>
              )}
              {isDone && (
                <Link
                  href={`/courses/${id}/assignments/${assignmentId}/results`}
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-sm font-semibold rounded-xl transition-colors"
                >
                  {t("ดูผลลัพธ์", "View Results")} →
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
