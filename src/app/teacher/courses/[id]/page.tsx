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
import { useCan } from "@/lib/useCan";
import { CourseIcon } from "@/components/CourseIcon";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
import { toGradeCount } from "@/lib/gradingStage";
export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const can = useCan();     // a TA reads the course overview; the course's text, details and grading categories are the teacher's (10/11/2569)
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

  const [descEditing, setDescEditing] = useState(false);
  const [descValue, setDescValue] = useState("");

  function openEditDesc() {
    if (!course) return;
    setDescValue(course.description ?? "");
    setDescEditing(true);
  }

  function cancelEditDesc() {
    setDescEditing(false);
  }

  function handleSaveDesc() {
    updateCourse(id, { description: descValue.trim() });
    setDescEditing(false);
  }

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

  // pieces of work still waiting for a grader — says what to do, where "2 Active" counted assignments (10/11/2569)
  const toGrade = assignments.reduce((sum, a) => sum + toGradeCount(getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId))), 0);
  const allGraded =
    assignments.length > 0 &&
    assignments.every((a) => {
      const subs = getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId));
      return subs.length > 0 && subs.every((s) => s.status === "graded");
    });

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
    );
  }

  return (
      <main className="w-full px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชาทั้งหมด", "All Courses")}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{course.name}</span>
        </div>

        {/* Course header banner */}
        <div className="relative h-36 rounded-2xl mb-6 overflow-hidden" style={{ background: course.coverColor }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <IconTile course={course.icon} size="md" tone="onDark" />
            <div className="min-w-0">
              {course.code && <p className="text-white/80 text-xs font-semibold tracking-wide tabular-nums truncate">{course.code}</p>}
              <h1 className="text-xl font-bold text-white truncate">{course.name}</h1>
            </div>
          </div>
          {can.editAssignment && <Link
            href={`/teacher/courses/${id}/settings`}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Icon name="settings" size="sm" />
            {t("ตั้งค่า", "Settings")}
          </Link>}
        </div>

        {/* Description — its own card, separate from the banner (30/9/2569), with inline edit */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("คำอธิบายรายวิชา", "Description")}</h2>
            {!descEditing && can.editAssignment && (
              <IconButton icon="edit" label={t("แก้ไข", "Edit")} onClick={openEditDesc} />
            )}
          </div>
          {descEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                rows={3}
                placeholder="อธิบายรายวิชาโดยย่อ (ไม่บังคับ)"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditDesc}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDesc}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-medium transition-colors"
                >
                  {t("บันทึก", "Save")}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {course.description || <span className="text-[var(--text-muted)]">{t("ยังไม่มีคำอธิบายรายวิชา", "No description yet")}</span>}
            </p>
          )}
        </div>

        {/* Stats strip — one compact bar instead of 3 tall cards */}
        <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm mb-6">
          {[
            {
              label: t("นักศึกษา", "Students"), value: `${students.length}`,
              icon: "users" as const,
            },
            {
              label: t("ชิ้นงาน", "Assignments"), value: `${assignments.length}`,
              icon: "file-text" as const,
            },
            {
              label: t("สถานะการตรวจ", "Grading Status"),
              value: allGraded ? t("ตรวจครบแล้ว", "All Graded") : `${toGrade} ${t("ชิ้นรอตรวจ", "to grade")}`,
              icon: allGraded ? ("check" as const) : ("calendar" as const),
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3.5">
              <IconTile icon={s.icon} size="sm" tone={s.label === t("สถานะการตรวจ", "Grading Status") && allGraded ? "accent" : "neutral"} />
              <div className="min-w-0">
                <p className="text-base font-bold text-[var(--text-primary)] leading-tight truncate">{s.value}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Details */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("รายละเอียด", "Details")}</h2>
              {!detailsEditing && can.editAssignment && (
                <IconButton icon="edit" label={t("แก้ไข", "Edit")} onClick={openEditDetails} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {detailsEditing ? (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--accent)]">{t("รายวิชา", "Course")}</label>
                  <input
                    value={detailsName}
                    onChange={(e) => setDetailsName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
                    placeholder="เช่น 811"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
              <DetailField label={t("อีเมล", "Email")} value={instructor?.email} span2 />
            </div>
            {detailsEditing && (
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={cancelEditDetails}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
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
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t("สัดส่วนคะแนน", "Grading Categories")}</h2>
              {can.editAssignment && <button
                onClick={openAddCategory}
                disabled={catFormOpen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="plus" size="sm" />
                {t("เพิ่มเกณฑ์คะแนน", "Add Category")}
              </button>}
            </div>

            {categories.length === 0 && !catFormOpen ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีข้อมูล", "No data")}</p>
                <p className="text-xs text-[var(--text-secondary)]">{t("เช่น Quiz, Midterm, Final, Project ฯลฯ", "e.g. Quiz, Midterm, Final, Project")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="grid gap-0 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/60" style={{ gridTemplateColumns: "1fr 96px 64px" }}>
                  {[t("หัวข้อ", "Category"), t("น้ำหนัก (%)", "Weight (%)"), ""].map((h, i) => (
                    <div key={i} className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{h}</div>
                  ))}
                </div>
                {categories.map((cat, idx) => {
                  const isRowLast = idx === categories.length - 1 && !(catFormOpen && !catEditingId);
                  return catEditingId === cat.id ? (
                    <div
                      key={cat.id}
                      className={`grid gap-0 items-center py-2 bg-[var(--accent-subtle)] ${isRowLast ? "" : "border-b border-[var(--border-subtle)]"}`}
                      style={{ gridTemplateColumns: "1fr 96px 64px" }}
                    >
                      <div className="px-3">
                        <input
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="เช่น Midterm"
                          autoFocus
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
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
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-surface)] text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                        />
                      </div>
                      <div className="px-3 flex items-center gap-1">
                        <IconButton icon="x" label={t("ยกเลิก", "Cancel")} onClick={cancelCategoryForm} />
                        <IconButton icon="check" label={t("บันทึก", "Save")} onClick={handleSaveCategory} disabled={!catName.trim() || !Number(catWeight)} />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={cat.id}
                      className={`grid gap-0 items-center py-2.5 transition-colors hover:bg-[var(--bg-subtle)]/50 ${isRowLast ? "" : "border-b border-[var(--border-subtle)]"}`}
                      style={{ gridTemplateColumns: "1fr 96px 64px" }}
                    >
                      <div className="px-3 text-sm text-[var(--text-primary)]">{cat.name}</div>
                      <div className="px-3 text-sm font-semibold text-[var(--accent)] tabular-nums">{cat.weight}%</div>
                      <div className="px-3 flex items-center gap-1">
                        {can.editAssignment && <IconButton icon="edit" label={t("แก้ไข", "Edit")} onClick={() => openEditCategory(cat)} disabled={catFormOpen} />}
                        {can.editAssignment && <IconButton icon="trash" label={t("ลบ", "Delete")} tone="danger" onClick={() => handleDeleteCategory(cat)} disabled={catFormOpen} />}
                      </div>
                    </div>
                  );
                })}

                {/* New-category row — appended in place instead of a form panel below */}
                {catFormOpen && !catEditingId && (
                  <div className="grid gap-0 items-center py-2 bg-[var(--accent-subtle)]" style={{ gridTemplateColumns: "1fr 96px 64px" }}>
                    <div className="px-3">
                      <input
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="เช่น Midterm"
                        autoFocus
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg-surface)] text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-colors"
                      />
                    </div>
                    <div className="px-3 flex items-center gap-1">
                      <IconButton icon="x" label={t("ยกเลิก", "Cancel")} onClick={cancelCategoryForm} />
                      <IconButton icon="check" label={t("บันทึก", "Save")} onClick={handleSaveCategory} disabled={!catName.trim() || !Number(catWeight)} />
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
      <p className="text-sm text-[var(--text-primary)]">{value || <span className="text-[var(--text-muted)]">{placeholder ?? "—"}</span>}</p>
    </div>
  );
}
