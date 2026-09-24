"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn, withdrawnIds } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useGradingCategories, GradingCategory } from "@/lib/gradingCategories";
import { DAY_OPTIONS, SLOT_OPTIONS, parseSchedule } from "@/lib/schedule";
import { useLanguage } from "@/context/LanguageContext";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse, updateCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { getTeachersByCourse } = useManagedTeachers();
  const { getCategoriesByCourse, addCategory, updateCategory, removeCategory } = useGradingCategories();
  const course = getCourse(id);
  const roster = getStudentsByCourse(id);
  // Withdrawn students don't count toward the class numbers (24/9/2569).
  const students = roster.filter((s) => !isWithdrawn(s));
  const withdrawn = withdrawnIds(roster);
  const assignments = getAssignmentsByCourse(id);
  const instructor = course ? getTeachersByCourse(course.id)[0] : undefined;
  const categories = course ? getCategoriesByCourse(course.id) : [];
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catWeight, setCatWeight] = useState("");

  const [detailsEditing, setDetailsEditing] = useState(false);
  const [detailsName, setDetailsName] = useState("");
  const [detailsDay, setDetailsDay] = useState("");
  const [detailsSlot, setDetailsSlot] = useState("");
  const [detailsRoom, setDetailsRoom] = useState("");

  function openEditDetails() {
    if (!course) return;
    setDetailsName(course.name);
    const { day, slot } = parseSchedule(course.schedule);
    setDetailsDay(day);
    setDetailsSlot(slot);
    setDetailsRoom(course.room ?? "");
    setDetailsEditing(true);
  }

  function cancelEditDetails() {
    setDetailsEditing(false);
  }

  function handleSaveDetails() {
    const name = detailsName.trim();
    if (!name) return;
    updateCourse(id, {
      name,
      schedule: detailsDay && detailsSlot ? `${detailsDay} ${detailsSlot}` : undefined,
      room: detailsRoom.trim() || undefined,
    });
    setDetailsEditing(false);
  }

  function openAddCategory() {
    setCatEditingId(null);
    setCatName("");
    setCatWeight("");
    setCatFormOpen(true);
  }

  function openEditCategory(cat: GradingCategory) {
    setCatEditingId(cat.id);
    setCatName(cat.name);
    setCatWeight(String(cat.weight));
    setCatFormOpen(true);
  }

  function cancelCategoryForm() {
    setCatFormOpen(false);
    setCatEditingId(null);
  }

  function handleSaveCategory() {
    const name = catName.trim();
    const weight = Number(catWeight);
    if (!name || !Number.isFinite(weight) || weight <= 0) return;
    if (catEditingId) {
      updateCategory(catEditingId, { name, weight });
    } else {
      addCategory({ courseId: id, name, weight });
    }
    setCatFormOpen(false);
    setCatEditingId(null);
  }

  function handleDeleteCategory(cat: GradingCategory) {
    if (!window.confirm(t(`ลบหมวด "${cat.name}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${cat.name}"? Cannot be undone.`))) return;
    removeCategory(cat.id);
  }

  const activeAssignments = assignments.filter((a) => {
    const subs = getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId));
    return subs.length > 0 && subs.some((s) => s.status !== "graded");
  }).length;
  const allGraded =
    assignments.length > 0 &&
    assignments.every((a) => {
      const subs = getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId));
      return subs.length > 0 && subs.every((s) => s.status === "graded");
    });

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
    );
  }

  return (
      <main className="w-full px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชาทั้งหมด", "All Courses")}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{course.name}</span>
        </div>

        {/* Course header banner */}
        <div className="relative h-36 rounded-2xl mb-6 overflow-hidden" style={{ background: course.coverColor }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{course.name}</h1>
              {course.description && (
                <p className="text-white/70 text-xs mt-0.5 max-w-md truncate">{course.description}</p>
              )}
            </div>
          </div>
          <Link
            href={`/teacher/courses/${id}/settings`}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium rounded-lg transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.22 3.22l1.41 1.41M9.37 9.37l1.41 1.41M3.22 10.78l1.41-1.41M9.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {t("ตั้งค่า", "Settings")}
          </Link>
        </div>

        {/* Stats strip — one compact bar instead of 3 tall cards */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
          {[
            {
              label: t("นักศึกษา", "Students"), value: `${students.length}`,
              icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
            },
            {
              label: t("ชิ้นงาน", "Assignments"), value: `${assignments.length}`,
              icon: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6" />,
            },
            {
              label: t("สถานะการตรวจ", "Grading Status"),
              value: allGraded ? t("ตรวจครบแล้ว", "All Graded") : `${activeAssignments} ${t("กำลังดำเนินการ", "Active")}`,
              icon: allGraded ? <polyline points="20 6 9 17 4 12" /> : <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.label === t("สถานะการตรวจ", "Grading Status") && allGraded ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-gray-50 text-gray-400"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-[var(--text-primary)] leading-tight truncate">{s.value}</p>
                <p className="text-xs text-gray-500 truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("รายละเอียด", "Details")}</h2>
              {!detailsEditing && (
                <button
                  onClick={openEditDetails}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors"
                  title={t("แก้ไข", "Edit")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {detailsEditing ? (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--accent)]">{t("รายวิชา", "Course")}</label>
                  <input
                    value={detailsName}
                    onChange={(e) => setDetailsName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              ) : (
                <DetailField label={t("รายวิชา", "Course")} value={course.name} span2 />
              )}

              <DetailField label={t("รหัสวิชา", "Course Code")} value={course.code} />
              <DetailField label={t("กลุ่มเรียน", "Section")} value={course.sectionNumber} />

              {detailsEditing ? (
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[var(--accent)]">{t("วันเรียน", "Day")}</label>
                    <select
                      value={detailsDay}
                      onChange={(e) => setDetailsDay(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    >
                      <option value="">{t("เลือกวัน", "Select day")}</option>
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{t(d.labelTh, d.labelEn)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[var(--accent)]">{t("คาบเวลา", "Time Slot")}</label>
                    <select
                      value={detailsSlot}
                      onChange={(e) => setDetailsSlot(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    >
                      <option value="">{t("เลือกคาบเวลา", "Select time slot")}</option>
                      {SLOT_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{t(s.labelTh, s.labelEn)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <DetailField label={t("วันและเวลาเรียน", "Schedule")} value={course.schedule} placeholder={t("ยังไม่กำหนด", "Not set")} />
              )}

              {detailsEditing ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--accent)]">{t("ห้องเรียน", "Room")}</label>
                  <input
                    value={detailsRoom}
                    onChange={(e) => setDetailsRoom(e.target.value)}
                    placeholder={t("เช่น 811", "e.g. 811")}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              ) : (
                <DetailField label={t("ห้องเรียน", "Room")} value={course.room} placeholder={t("ยังไม่กำหนด", "Not set")} />
              )}

              <DetailField
                label={t("อาจารย์ประจำวิชา", "Instructor")}
                value={instructor ? `${instructor.title ? `${instructor.title} ` : ""}${instructor.name}` : undefined}
                span2
              />
              <DetailField label="Email" value={instructor?.email} span2 />
            </div>
            {detailsEditing && (
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={cancelEditDetails}
                  className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  disabled={!detailsName.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("บันทึก", "Save")}
                </button>
              </div>
            )}
            {!detailsEditing && (!course.schedule || !course.room) && (
              <p className="text-xs text-[var(--s-err-text)] mt-4">
                {t("กรุณากำหนดข้อมูลวัน เวลาเรียน และห้องเรียนให้เรียบร้อย", "Please set the class schedule and room")}
              </p>
            )}
          </div>

          {/* Grading Categories — สัดส่วนคะแนน */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("สัดส่วนคะแนน", "Grading Categories")}</h2>
              <button
                onClick={openAddCategory}
                disabled={catFormOpen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                {t("เพิ่มเกณฑ์คะแนน", "Add Category")}
              </button>
            </div>

            {categories.length === 0 && !catFormOpen ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มีข้อมูล", "No data")}</p>
                <p className="text-xs text-gray-500">{t("เช่น Quiz, Midterm, Final, Project ฯลฯ", "e.g. Quiz, Midterm, Final, Project")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid gap-0 border-b border-gray-100 bg-gray-50/60" style={{ gridTemplateColumns: "1fr 96px 64px" }}>
                  {[t("หัวข้อ", "Category"), t("น้ำหนัก (%)", "Weight (%)"), ""].map((h, i) => (
                    <div key={i} className="px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</div>
                  ))}
                </div>
                {categories.map((cat, idx) => {
                  const isRowLast = idx === categories.length - 1 && !(catFormOpen && !catEditingId);
                  return catEditingId === cat.id ? (
                    <div
                      key={cat.id}
                      className={`grid gap-0 items-center py-2 bg-[#F0FFFE] ${isRowLast ? "" : "border-b border-gray-50"}`}
                      style={{ gridTemplateColumns: "1fr 96px 64px" }}
                    >
                      <div className="px-3">
                        <input
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder={t("เช่น Midterm", "e.g. Midterm")}
                          autoFocus
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                        />
                      </div>
                      <div className="px-3">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={catWeight}
                          onChange={(e) => setCatWeight(e.target.value)}
                          placeholder="30"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                        />
                      </div>
                      <div className="px-3 flex items-center gap-1">
                        <button
                          onClick={cancelCategoryForm}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors"
                          title={t("ยกเลิก", "Cancel")}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                        <button
                          onClick={handleSaveCategory}
                          disabled={!catName.trim() || !Number(catWeight)}
                          className="p-1 rounded-lg hover:bg-[var(--accent-bright)]/10 text-[var(--accent)] transition-colors disabled:opacity-40"
                          title={t("บันทึก", "Save")}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={cat.id}
                      className={`grid gap-0 items-center py-2.5 transition-colors hover:bg-gray-50/50 ${isRowLast ? "" : "border-b border-gray-50"}`}
                      style={{ gridTemplateColumns: "1fr 96px 64px" }}
                    >
                      <div className="px-3 text-sm text-[var(--text-primary)]">{cat.name}</div>
                      <div className="px-3 text-sm font-semibold text-[var(--accent)] tabular-nums">{cat.weight}%</div>
                      <div className="px-3 flex items-center gap-1">
                        <button
                          onClick={() => openEditCategory(cat)}
                          disabled={catFormOpen}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                          title={t("แก้ไข", "Edit")}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          disabled={catFormOpen}
                          className="p-1 rounded-lg hover:bg-[var(--s-err-bg)] text-gray-500 hover:text-[var(--s-err-text)] transition-colors disabled:opacity-50"
                          title={t("ลบ", "Delete")}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* New-category row — appended in place instead of a form panel below */}
                {catFormOpen && !catEditingId && (
                  <div className="grid gap-0 items-center py-2 bg-[#F0FFFE]" style={{ gridTemplateColumns: "1fr 96px 64px" }}>
                    <div className="px-3">
                      <input
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder={t("เช่น Midterm", "e.g. Midterm")}
                        autoFocus
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                      />
                    </div>
                    <div className="px-3">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={catWeight}
                        onChange={(e) => setCatWeight(e.target.value)}
                        placeholder="30"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                      />
                    </div>
                    <div className="px-3 flex items-center gap-1">
                      <button
                        onClick={cancelCategoryForm}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors"
                        title={t("ยกเลิก", "Cancel")}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                      <button
                        onClick={handleSaveCategory}
                        disabled={!catName.trim() || !Number(catWeight)}
                        className="p-1 rounded-lg hover:bg-[var(--accent-bright)]/10 text-[var(--accent)] transition-colors disabled:opacity-40"
                        title={t("บันทึก", "Save")}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className={[
              "text-xs font-medium mt-4",
              totalWeight === 100 ? "text-[var(--accent)]" : "text-[var(--s-err-text)]",
            ].join(" ")}>
              {t(`คะแนนรวมตอนนี้ ${totalWeight}%`, `Total so far: ${totalWeight}%`)}
              {totalWeight !== 100 && ` (${t("ต้องเป็น 100%", "must equal 100%")})`}
            </p>
          </div>
        </div>
      </main>
  );
}

function DetailField({ label, value, placeholder, span2 }: { label: string; value?: string; placeholder?: string; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : undefined}>
      <p className="text-xs font-semibold text-[var(--accent)] mb-1">{label}</p>
      <p className="text-sm text-[var(--text-primary)]">{value || <span className="text-gray-400">{placeholder ?? "—"}</span>}</p>
    </div>
  );
}
