"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";
import { useAssignments, Assignment, Submission } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function rowStatus(a: Assignment, subs: Submission[], today: string) {
  const isOverdue = a.dueDate < today;
  const allGraded = subs.length > 0 && subs.every((s) => s.status === "graded");
  if (allGraded) {
    const avg = Math.round(subs.reduce((acc, s) => acc + (s.aiScore ?? 0), 0) / subs.length);
    return { type: "graded" as const, label: "All Graded", avg };
  }
  if (isOverdue && subs.length > 0) {
    const pending = subs.filter((s) => s.status !== "graded").length;
    return { type: "late" as const, label: `Late (${pending})`, avg: null };
  }
  return { type: "none" as const, label: "Not Graded", avg: null };
}

export default function AssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse, removeCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment, removeAssignment } = useAssignments();

  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const course = getCourse(id);
  const students = getStudentsByCourse(id);
  const assignments = getAssignmentsByCourse(id);
  const today = new Date().toISOString().split("T")[0];

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
        </main>
    );
  }

  const totalAssignments = assignments.length;
  const graded = assignments.filter((a) => {
    const s = getSubmissionsByAssignment(a.id);
    return s.length > 0 && s.every((x) => x.status === "graded");
  }).length;
  const pendingReview = assignments.reduce((acc, a) =>
    acc + getSubmissionsByAssignment(a.id).filter((s) => s.status === "need_review").length, 0);
  const overdue = assignments.filter((a) => {
    const s = getSubmissionsByAssignment(a.id);
    return a.dueDate < today && s.some((x) => x.status !== "graded");
  }).length;

  const visible = search
    ? assignments.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : assignments;

  const sourceLabel: Record<string, string> = {
    manual: t("เพิ่มเอง", "Manually Added"),
    google: "Google Classroom",
    teams: "Microsoft Teams",
  };

  function handleDelete() {
    if (window.confirm(t(`ลบ "${course?.name}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${course?.name}"? This cannot be undone.`))) {
      removeCourse(id);
      router.push("/teacher/courses");
    }
  }

  const statCards = [
    {
      label: t("งานทั้งหมด", "Total Assignments"),
      value: totalAssignments,
      iconBg: "bg-blue-100",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
        </svg>
      ),
    },
    {
      label: t("ตรวจแล้ว", "Graded"),
      value: graded,
      iconBg: "bg-green-100",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
        </svg>
      ),
    },
    {
      label: t("รอตรวจสอบ", "Pending Review"),
      value: pendingReview,
      iconBg: "bg-yellow-100",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 3h14l-2 7H7L5 3z"/><path d="M7 10l-2 11h14L17 10"/><circle cx="12" cy="16" r="1" fill="#D97706"/>
        </svg>
      ),
    },
    {
      label: t("เลยกำหนด", "Overdue"),
      value: overdue,
      iconBg: "bg-red-100",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
      <main className="w-full max-w-[1200px] mx-auto px-8 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("ชิ้นงาน", "Assignments")}</span>
        </div>

        {/* Course header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{course.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500">
              <span>{sourceLabel[course.source] ?? course.source}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>{students.length} {t("นักศึกษา", "Students")}</span>
              <span className="text-gray-300">|</span>
              <Link href={`/teacher/courses/${id}/settings`} className="text-[var(--accent)] hover:underline font-medium">{t("แก้ไข", "Edit")}</Link>
              <button onClick={handleDelete} className="text-red-400 hover:underline font-medium">{t("ลบรายวิชา", "Delete this Course")}</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {t("จัดการผู้ร่วมงาน", "Manage Collaborators")}
            </button>
            <Link
              href={`/teacher/courses/${id}/assignments/new`}
              className="flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A] font-medium rounded-xl text-sm transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("สร้างชิ้นงาน", "Create Assignment")}
            </Link>
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Course description */}
        {course.description && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <p className="text-xs text-gray-500 mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</p>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{course.description}</p>
              <Link href={`/teacher/courses/${id}/settings`} className="text-[var(--accent)] text-sm hover:underline shrink-0">{t("แก้ไข", "Edit")}</Link>
            </div>
          </div>
        )}

        {/* Assignments list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--text-primary)]">{t("ชิ้นงานที่ใช้งานอยู่", "Active Assignments")}</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("ค้นหาชิ้นงาน...", "Search tasks...")}
                  className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] w-48"
                />
              </div>
              <button className="text-gray-500 hover:text-gray-600 transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              {search ? (
                <p className="text-gray-500 text-sm">{t(`ไม่พบชิ้นงานที่ตรงกับ "${search}"`, `No results for "${search}"`)}</p>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มีชิ้นงาน", "No assignments yet")}</p>
                  <p className="text-xs text-gray-500 mb-4">{t("กด Create Assignment เพื่อเพิ่มชิ้นงานแรก", "Click Create Assignment to add your first one")}</p>
                  <Link
                    href={`/teacher/courses/${id}/assignments/new`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A] text-sm font-medium rounded-xl transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    {t("สร้างชิ้นงาน", "Create Assignment")}
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              {visible.map((a) => {
                const subs = getSubmissionsByAssignment(a.id);
                const st = rowStatus(a, subs, today);
                const isOverdue = a.dueDate < today && st.type !== "graded";
                return (
                  <div key={a.id} className="border-b border-gray-50 last:border-0">
                    {/* Main row */}
                    <div className="flex items-center px-5 py-4 hover:bg-[var(--surface)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/teacher/courses/${id}/assignments/${a.id}`}
                          className="text-[var(--accent)] font-medium hover:underline text-sm"
                        >
                          {a.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isOverdue ? "#EF4444" : "#9CA3AF"} strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          <span className={`text-xs ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
                            {isOverdue ? `${t("เลยกำหนด", "Overdue")} — ` : ""}{t("กำหนดส่ง", "Due")} {fmtDate(a.dueDate)}
                            {subs.length > 0 && ` • ${subs.length} ${t("งานที่ส่ง", "Submissions")}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {a.submissionType === "group" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-medium">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                              </svg>
                              {t("กลุ่ม", "Group")}{a.maxGroupSize ? ` ≤ ${a.maxGroupSize} ${t("คน", "members")}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500 text-[10px] font-medium">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                              </svg>
                              {t("รายบุคคล", "Individual")}
                            </span>
                          )}
                          {(a.fileTypes ?? []).map(ft => (
                            <span key={ft} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-mono">
                              {ft === "figma" ? "Figma" : ft === "pdf" ? "PDF" : t("รูปภาพ", "Image")}
                            </span>
                          ))}
                          {!(a.acceptsFiles ?? true) && (
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500 text-[10px]">{t("ไม่รับไฟล์", "No files")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {st.avg !== null && (
                          <span className="text-xs text-gray-500">
                            {t("คะแนนเฉลี่ย:", "Avg Score:")} <span className="font-semibold text-[var(--text-primary)]">{st.avg}%</span>
                          </span>
                        )}
                        <span className={[
                          "text-xs px-2.5 py-1 rounded-full font-medium",
                          st.type === "graded" ? "bg-green-100 text-green-700"
                          : st.type === "late" ? "bg-slate-700 text-white"
                          : "bg-red-100 text-red-700",
                        ].join(" ")}>
                          {st.type === "graded"
                            ? t("ตรวจครบแล้ว", "All Graded")
                            : st.type === "late"
                            ? `${t("ส่งช้า", "Late")} (${subs.filter(s => s.status !== "graded").length})`
                            : t("ยังไม่ตรวจ", "Not Graded")}
                        </span>
                        {/* ▼ dropdown menu */}
                        <div className="relative" ref={openMenu === a.id ? menuRef : undefined}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id); }}
                            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 15 11"/>
                            </svg>
                          </button>
                          {openMenu === a.id && (
                            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-36 text-sm">
                              <Link
                                href={`/teacher/courses/${id}/assignments/${a.id}/edit`}
                                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50"
                                onClick={() => setOpenMenu(null)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                {t("แก้ไข", "Edit")}
                              </Link>
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  if (window.confirm(t(`ลบ "${a.name}" ถาวร?`, `Permanently delete "${a.name}"?`))) {
                                    removeAssignment(a.id);
                                  }
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 w-full text-left"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                                {t("ลบ", "Delete")}
                              </button>
                            </div>
                          )}
                        </div>
                        {/* › expand toggle */}
                        <button
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"
                            className={`transition-transform duration-200 ${expanded === a.id ? "rotate-90" : ""}`}
                          >
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {expanded === a.id && (() => {
                      const graded = subs.filter(s => s.status === "graded").length;
                      const needReview = subs.filter(s => s.status === "need_review").length;
                      const notGraded = subs.filter(s => s.status === "not_graded").length;
                      return (
                        <div className="px-5 pb-4 bg-[var(--surface)] border-t border-[var(--border)]">
                          <div className="pt-4 flex gap-6">
                            {/* Left: description + submission breakdown */}
                            <div className="flex-1 min-w-0">
                              {a.description ? (
                                <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{a.description}</p>
                              ) : (
                                <p className="text-xs text-gray-300 italic mb-3">{t("ไม่มีคำอธิบาย", "No description")}</p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block"/>
                                  {t("ตรวจแล้ว", "Graded")} {graded}
                                </span>
                                {needReview > 0 && (
                                  <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block"/>
                                    {t("รอตรวจสอบ", "Need Review")} {needReview}
                                  </span>
                                )}
                                {notGraded > 0 && (
                                  <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"/>
                                    {t("ยังไม่ตรวจ", "Not Graded")} {notGraded}
                                  </span>
                                )}
                                {subs.length === 0 && (
                                  <span className="text-xs text-gray-300">{t("ยังไม่มีการส่งงาน", "No submissions yet")}</span>
                                )}
                              </div>
                            </div>
                            {/* Right: actions */}
                            <div className="flex items-end gap-2 shrink-0">
                              {needReview > 0 && (
                                <Link
                                  href={`/teacher/courses/${id}/assignments/${a.id}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A] text-xs font-medium rounded-lg transition-colors"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                  </svg>
                                  {t("เริ่มตรวจงาน", "Start Grading")}
                                </Link>
                              )}
                              <Link
                                href={`/teacher/courses/${id}/assignments/${a.id}`}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-white transition-colors"
                              >
                                {t("ดูงานที่ส่ง", "View Submissions")}
                              </Link>
                              <Link
                                href={`/teacher/courses/${id}/assignments/${a.id}/edit`}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-white transition-colors"
                              >
                                {t("แก้ไข", "Edit")}
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {visible.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500">
                  <span>{t("แสดง", "Showing")} <span className="font-medium text-[var(--text-primary)]">1–{visible.length}</span> {t("จาก", "of")} <span className="font-medium text-[var(--text-primary)]">{visible.length}</span> {t("งาน", "assignments")}</span>
                  {visible.length > 5 && (
                    <div className="flex gap-1">
                      {[1, 2, 3].map((p) => (
                        <button key={p} className={[
                          "w-7 h-7 rounded-full text-xs font-medium",
                          p === 1 ? "bg-[#2DD4BF] text-[#1B2A4A]" : "text-gray-500 hover:bg-gray-100",
                        ].join(" ")}>{p}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
  );
}
