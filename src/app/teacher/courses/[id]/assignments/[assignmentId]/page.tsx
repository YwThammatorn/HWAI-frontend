"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, Submission } from "@/lib/assignments";
import { useStudents } from "@/lib/students";
import { useLanguage } from "@/context/LanguageContext";

const AVATAR_COLORS = ["#4F46E5", "#7C3AED", "#BE185D", "#B45309", "#047857", "#0369A1", "#C2410C", "#0E7490"];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  const { t } = useLanguage();
  const cfg = {
    need_review: { label: t("รอตรวจสอบ", "Need Review"), className: "bg-purple-100 text-purple-700" },
    not_graded:  { label: t("ยังไม่ตรวจ", "Not Graded"),  className: "bg-red-100 text-red-700" },
    graded:      { label: t("ตรวจแล้ว", "Graded"),      className: "bg-green-100 text-green-700" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "need_review" ? "bg-purple-400" : status === "not_graded" ? "bg-red-400" : "bg-green-400"}`} />
      {cfg.label}
    </span>
  );
}

export default function ViewAssignmentPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment } = useAssignments();
  const { getStudentsByCourse } = useStudents();

  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const submissions = getSubmissionsByAssignment(assignmentId);
  const enrolledCount = getStudentsByCourse(id).length;

  if (!course || !assignment) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">{t("กลับรายการงาน", "Back to assignments")}</Link>
        </main>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = assignment.dueDate < today;
  const allGraded = submissions.length > 0 && submissions.every((s) => s.status === "graded");
  const avgScore = submissions.length > 0
    ? Math.round(submissions.filter((s) => s.aiScore !== null).reduce((acc, s) => acc + (s.aiScore ?? 0), 0) /
        (submissions.filter((s) => s.aiScore !== null).length || 1))
    : 0;
  const gradedCount = submissions.filter((s) => s.status === "graded").length;

  const uploadLink = `https://hwai-agent.kmitl.ac.th/submit/${assignmentId.replace("a-", "")}`;

  function handleCopy() {
    navigator.clipboard.writeText(uploadLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const visible = search
    ? submissions.filter((s) =>
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : submissions;

  return (
      <main className="w-full max-w-[1200px] mx-auto px-8 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{assignment.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{assignment.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-gray-500">{t("กำหนดส่ง", "Due")} {fmtDate(assignment.dueDate)} {t("เวลา 23:59 น.", "at 11:59 PM")}</span>
              <span className="text-gray-300">·</span>
              {allGraded ? (
                <span className="text-emerald-500 font-medium">{t("ตรวจครบแล้ว", "All Graded")}</span>
              ) : isOverdue ? (
                <span className="text-red-500 font-medium">{t("เลยกำหนด", "Overdue")}</span>
              ) : (
                <span className="text-orange-500 font-medium">{t("ยังไม่ตรวจ", "Not Graded")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {t("แก้ไขงาน", "Edit Assignment")}
            </Link>
            <Link
              href={allGraded
                ? `/teacher/courses/${id}/assignments/${assignmentId}/results`
                : `/teacher/courses/${id}/assignments/${assignmentId}/grading`}
              className="flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
            >
              {allGraded ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  {t("ดูผลลัพธ์", "View Results")}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {t("เริ่มตรวจงาน", "Start Grading")}
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Upload link */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {t("ลิงก์อัปโหลดงาน", "Assignment Submission Upload Link")}
          </div>
          <div className="flex-1 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500 font-mono truncate border border-gray-100">
            {uploadLink}
          </div>
          <button
            onClick={handleCopy}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
              copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "border border-gray-200 text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{t("คัดลอกแล้ว", "Copied")}</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{t("คัดลอก", "Copy")}</>
            )}
          </button>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {/* Submissions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t("งานที่ส่ง", "Submissions")}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {submissions.length}
              <span className="text-sm font-normal text-gray-500">
                {enrolledCount > 0 ? ` / ${enrolledCount}` : ""}
              </span>
            </p>
            {enrolledCount > 0 ? (
              <>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2DD4BF] rounded-full"
                    style={{ width: `${Math.min((submissions.length / enrolledCount) * 100, 100)}%` }}
                  />
                </div>
                {submissions.length < enrolledCount && (
                  <p className="text-xs text-gray-500 mt-1.5">{enrolledCount - submissions.length} {t("คนยังไม่ส่ง", "students pending")}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">{t("ยังไม่มีนักศึกษาใน course นี้", "No students enrolled")}</p>
            )}
          </div>
          {/* Average Grade */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t("คะแนนเฉลี่ย", "Average Grade")}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{submissions.length > 0 ? `${avgScore}%` : "0%"}</p>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              {t("ความมั่นใจ AI:", "AI Confidence:")} {submissions.length > 0 ? t("สูง", "High") : t("ไม่มี", "None")}
            </p>
          </div>
          {/* Graded */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 15 11"/>
              </svg>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t("ตรวจแล้ว", "Graded")}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{gradedCount} <span className="text-sm font-normal text-gray-500">{t("ฉบับ", "papers")}</span></p>
            <p className="text-xs text-gray-500 mt-1.5">
              {submissions.length - gradedCount > 0
                ? `${submissions.length - gradedCount} ${t("ยังไม่ตรวจ", "not graded")}`
                : submissions.length > 0 ? t("ตรวจครบแล้ว", "All graded") : t("ยังไม่มีงาน", "No submissions")}
            </p>
          </div>
          {/* Rubric */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 opacity-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t("เกณฑ์การให้คะแนน", "Rubric")}</p>
            {assignment.rubricIds.length > 0 ? (
              <>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{t("ใช้งานอยู่", "Applied")}</p>
                <div className="mt-2">
                  <Link
                    href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--accent)] text-xs text-[var(--accent)] font-medium hover:bg-teal-50 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {t("แก้ไข Rubric", "Edit Rubric")}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-300">{t("ไม่มี", "None")}</p>
                <p className="text-xs text-gray-500 mt-1.5">
                  <Link
                    href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {t("เพิ่ม Rubric", "Add Rubric")}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {assignment.description && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
            <p className="text-xs text-gray-500 mb-1.5">{t("คำอธิบายงาน", "Assignment Description")}</p>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{assignment.description}</p>
              <Link href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`} className="text-[var(--accent)] text-sm hover:underline shrink-0">{t("แก้ไข", "Edit")}</Link>
            </div>
          </div>
        )}

        {/* Submissions table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ค้นหานักศึกษา...", "Search students...")}
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] w-52"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              {t("กรอง: ทั้งหมด", "Filter: All Status")}
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm text-gray-500">{t("ยังไม่มีนักศึกษาส่งงาน", "No submissions yet")}</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-left text-xs text-gray-500 font-semibold">
                    <th className="px-5 py-3 w-8"><input type="checkbox" className="rounded border-gray-300" /></th>
                    <th className="px-3 py-3">{t("ชื่อนักศึกษา", "Student Name")}</th>
                    <th className="px-3 py-3">{t("ส่งเมื่อ", "Submitted")}</th>
                    <th className="px-3 py-3">
                      <span className="flex items-center gap-1">
                        {t("คะแนน AI", "AI Score")}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      </span>
                    </th>
                    <th className="px-3 py-3">{t("สถานะ", "Status")}</th>
                    <th className="px-3 py-3">{t("ไฟล์", "File")}</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: avatarColor(s.studentName) }}
                          >
                            {initials(s.studentName)}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)] text-sm">{s.studentName}</p>
                            <p className="text-xs text-gray-500">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-500">{fmtDateTime(s.submittedAt)}</td>
                      <td className="px-3 py-3.5">
                        {s.aiScore !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{s.aiScore}%</span>
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#2DD4BF] rounded-full" style={{ width: `${s.aiScore}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="px-3 py-3.5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </td>
                      <td className="px-3 py-3.5">
                        {(s.status === "need_review" || s.status === "graded") && (
                          <Link
                            href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${s.id}`}
                            className="text-xs text-[var(--accent)] hover:underline font-medium"
                          >
                            {s.status === "need_review" ? t("ตรวจสอบ", "Review") : t("ขอตรวจใหม่", "Recheck")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500 border-t border-gray-50">
                <span>{t("แสดง", "Showing")} <span className="font-medium text-[var(--text-primary)]">1–{visible.length}</span> {t("จาก", "of")} <span className="font-medium text-[var(--text-primary)]">{submissions.length}</span> {t("งาน", "submissions")}</span>
                {submissions.length > 5 && (
                  <div className="flex gap-1">
                    {[1, 2, 3].map((p) => (
                      <button key={p} className={[
                        "w-7 h-7 rounded-full text-xs font-medium",
                        p === 1 ? "bg-[#2DD4BF] text-[var(--text-primary)]" : "text-gray-500 hover:bg-gray-100",
                      ].join(" ")}>{p}</button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
  );
}
