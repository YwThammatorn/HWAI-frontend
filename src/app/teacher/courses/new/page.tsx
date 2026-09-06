"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCourses, PRESET_COLORS, Term } from "@/lib/courses";
import { useCurriculum } from "@/lib/curriculum";
import { useLanguage } from "@/context/LanguageContext";


export default function NewCoursePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { addCourse } = useCourses();
  const { curriculumVersions, getCourseTemplatesByCurriculum } = useCurriculum();
  const CONFIRM_MSG = t("ข้อมูลที่กรอกจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Your input will not be saved.\nLeave this page?");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(PRESET_COLORS[0]);

  const activeCurriculumVersions = curriculumVersions.filter((v) => v.effectiveTo === undefined);
  const [curriculumVersionId, setCurriculumVersionId] = useState("");
  const [courseTemplateId, setCourseTemplateId] = useState("");
  const courseTemplates = curriculumVersionId ? getCourseTemplatesByCurriculum(curriculumVersionId) : [];
  const currentAcademicYear = new Date().getFullYear() + 543;
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear));
  const [term, setTerm] = useState<Term | "">("");
  const [sectionNumber, setSectionNumber] = useState("");

  function handleCurriculumChange(id: string) {
    setCurriculumVersionId(id);
    setCourseTemplateId(""); // selected template belonged to the old curriculum's list
  }

  const isDirty =
    name.trim() !== "" ||
    description.trim() !== "" ||
    coverColor !== PRESET_COLORS[0] ||
    courseTemplateId !== "" ||
    sectionNumber.trim() !== "";

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function navAway(to: string) {
    if (isDirty && !window.confirm(CONFIRM_MSG)) return;
    router.push(to);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selectedTemplate = courseTemplates.find((ct) => ct.id === courseTemplateId);
    const year = academicYear.trim() === "" ? undefined : parseInt(academicYear, 10);
    const course = addCourse({
      name: name.trim(),
      description: description.trim(),
      status: "active",
      source: "manual",
      coverColor,
      iconColor: coverColor,
      ...(selectedTemplate && { courseTemplateId: selectedTemplate.id, code: selectedTemplate.code }),
      ...(year !== undefined && !isNaN(year) && { academicYear: year }),
      ...(term !== "" && { term }),
      ...(sectionNumber.trim() !== "" && { sectionNumber: sectionNumber.trim() }),
    });
    router.push(`/teacher/courses/${course.id}`);
  }

  const isValid = name.trim().length > 0;

  return (
      <main className="w-full max-w-[860px] mx-auto px-8 py-8">
        {/* Back */}
        <button onClick={() => navAway("/teacher/courses")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับไปรายวิชา", "Back to All Courses")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("เพิ่มรายวิชาใหม่", "Add New Course")}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{t("ข้อมูลทั่วไป", "General Information")}</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                {t("ชื่อรายวิชา", "Course Name")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("เช่น หลักการออกแบบ UX/UI", "e.g. UX/UI Design Principles")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("คำอธิบายสั้นๆ เกี่ยวกับรายวิชา...", "Brief description of the course...")}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </section>

          {/* Curriculum / Section linking — optional, only useful once curricula exist */}
          {activeCurriculumVersions.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">{t("หลักสูตรและภาคการศึกษา", "Curriculum & Term")}</h2>
              <p className="text-xs text-gray-500 mb-5">{t("ไม่บังคับ — ผูกวิชานี้เข้ากับหลักสูตรที่มีอยู่", "Optional — link this course to an existing curriculum's course template")}</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("หลักสูตร", "Curriculum Version")}</label>
                  <select
                    value={curriculumVersionId}
                    onChange={(e) => handleCurriculumChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">{t("ไม่ระบุ", "None")}</option>
                    {activeCurriculumVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.program} — {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("รายวิชาในหลักสูตร", "Course Template")}</label>
                  <select
                    value={courseTemplateId}
                    onChange={(e) => setCourseTemplateId(e.target.value)}
                    disabled={!curriculumVersionId}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
                  >
                    <option value="">{curriculumVersionId ? t("ไม่ระบุ", "None") : t("เลือกหลักสูตรก่อน", "Pick a curriculum first")}</option>
                    {courseTemplates.map((ct) => (
                      <option key={ct.id} value={ct.id}>{ct.code} — {ct.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("ปีการศึกษา", "Academic Year")}</label>
                  <input
                    type="number"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("ภาคเรียน", "Term")}</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value === "" ? "" : e.target.value === "summer" ? "summer" : (Number(e.target.value) as 1 | 2))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">{t("ไม่ระบุ", "None")}</option>
                    <option value="1">{t("ภาคเรียนที่ 1", "Term 1")}</option>
                    <option value="2">{t("ภาคเรียนที่ 2", "Term 2")}</option>
                    <option value="summer">{t("ภาคฤดูร้อน", "Summer")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("Section", "Section")}</label>
                  <input
                    value={sectionNumber}
                    onChange={(e) => setSectionNumber(e.target.value)}
                    placeholder={t("เช่น 1", "e.g. 1")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Course Visuals */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{t("รูปแบบรายวิชา", "Course Visuals")}</h2>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* Upload Icon */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">{t("อัปโหลดไอคอน", "Upload Icon Image")}</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-xs">{t("คลิกเพื่ออัปโหลด", "Click to upload")}</span>
                </div>
              </div>

              {/* Color Picker */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2 self-start">{t("สีปก", "Cover Color")}</label>
                <div className="w-16 h-16 rounded-xl mb-3 shadow" style={{ background: coverColor }} />
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCoverColor(c)}
                      className="w-7 h-7 rounded-lg border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: coverColor === c ? "#1B2A4A" : "transparent",
                        transform: coverColor === c ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Upload Cover */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">{t("อัปโหลดภาพปก", "Upload Cover Image")}</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-xs">{t("คลิกเพื่ออัปโหลด", "Click to upload")}</span>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-5">
              <p className="text-xs text-gray-500 mb-2">{t("ตัวอย่าง", "Preview")}</p>
              <div className="w-48 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="h-20 relative" style={{ background: coverColor }}>
                  <div className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{name || t("ชื่อรายวิชา", "Course Name")}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t("เพิ่มเอง", "Manually Added")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway("/teacher/courses")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("สร้างรายวิชา", "Create Course")}
            </button>
          </div>
        </form>
      </main>
  );
}
