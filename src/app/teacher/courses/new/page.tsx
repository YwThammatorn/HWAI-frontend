"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCourses, PRESET_COLORS, Term } from "@/lib/courses";
import { useCurriculum } from "@/lib/curriculum";
import { useLanguage } from "@/context/LanguageContext";
import { CourseIcon, COURSE_ICON_KEYS, type CourseIconKey } from "@/components/CourseIcon";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
// Teachers can't create their own courses for now (10/9/2569) — only admin
// creates sections and assigns teachers, via /admin/courses. Set this back
// to false to re-enable; form + logic below are kept intact, untouched.
const TEACHER_COURSE_CREATION_DISABLED = true;

export default function NewCoursePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { addCourse } = useCourses();
  const { curriculumVersions, getCourseTemplatesByCurriculum } = useCurriculum();
  const CONFIRM_MSG = t("ข้อมูลที่กรอกจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Your input will not be saved.\nLeave this page?");

  useEffect(() => {
    if (TEACHER_COURSE_CREATION_DISABLED) router.replace("/teacher/courses");
  }, [router]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<CourseIconKey>("book");

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
    icon !== "book" ||
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
      icon,
      ...(selectedTemplate && { courseTemplateId: selectedTemplate.id, code: selectedTemplate.code }),
      ...(year !== undefined && !isNaN(year) && { academicYear: year }),
      ...(term !== "" && { term }),
      ...(sectionNumber.trim() !== "" && { sectionNumber: sectionNumber.trim() }),
    });
    router.push(`/teacher/courses/${course.id}`);
  }

  const isValid = name.trim().length > 0;

  if (TEACHER_COURSE_CREATION_DISABLED) return null;

  return (
      <main className="w-full max-w-[860px] mx-auto px-8 py-8">
        {/* Back */}
        <button onClick={() => navAway("/teacher/courses")} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] mb-6 transition-colors">
          <Icon name="chevron-left" />
          {t("กลับไปรายวิชา", "Back to All Courses")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("เพิ่มรายวิชาใหม่", "Add New Course")}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5">{t("ข้อมูลทั่วไป", "General Information")}</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                {t("ชื่อรายวิชา", "Course Name")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น หลักการออกแบบ UX/UI"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="คำอธิบายสั้นๆ เกี่ยวกับรายวิชา..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </section>

          {/* Curriculum / Section linking — optional, only useful once curricula exist */}
          {activeCurriculumVersions.length > 0 && (
            <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t("หลักสูตรและภาคการศึกษา", "Curriculum & Term")}</h2>
              <p className="text-xs text-[var(--text-secondary)] mb-5">{t("ไม่บังคับ — ผูกวิชานี้เข้ากับหลักสูตรที่มีอยู่", "Optional — link this course to an existing curriculum's course template")}</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("หลักสูตร", "Curriculum Version")}</label>
                  <select
                    value={curriculumVersionId}
                    onChange={(e) => handleCurriculumChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:bg-[var(--disabled-bg)] disabled:text-[var(--text-muted)] transition-colors"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("ภาคเรียน", "Term")}</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value === "" ? "" : e.target.value === "summer" ? "summer" : (Number(e.target.value) as 1 | 2))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
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
                    placeholder="เช่น 1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Course Visuals */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5">{t("รูปแบบรายวิชา", "Course Visuals")}</h2>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* Icon Picker */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2 self-start">{t("ไอคอน", "Icon")}</label>
                <IconTile course={icon} size="lg" tone="cover" className="mb-3 shadow" style={{ background: coverColor }} />
                <div className="grid grid-cols-4 gap-1.5">
                  {COURSE_ICON_KEYS.map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setIcon(k)}
                      aria-label={k}
                      aria-pressed={icon === k}
                      className={[
                        "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all",
                        icon === k
                          ? "border-[var(--text-primary)] text-[var(--text-primary)] scale-110"
                          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      <CourseIcon iconKey={k} size="sm" />
                    </button>
                  ))}
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
                        borderColor: coverColor === c ? "var(--text-primary)" : "transparent",
                        transform: coverColor === c ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Upload Cover */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">{t("อัปโหลดภาพปก", "Upload Cover Image")}</label>
                <div className="border-2 border-dashed border-[var(--border)] rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                  <Icon name="image" size="xl" />
                  <span className="text-xs">{t("คลิกเพื่ออัปโหลด", "Click to upload")}</span>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-5">
              <p className="text-xs text-[var(--text-secondary)] mb-2">{t("ตัวอย่าง", "Preview")}</p>
              <div className="w-48 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-sm">
                <div className="h-20 relative" style={{ background: coverColor }}>
                  <IconTile course={icon} size="sm" tone="onDark" />
                </div>
                <div className="bg-[var(--bg-surface)] p-3">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{name || t("ชื่อรายวิชา", "Course Name")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway("/teacher/courses")}
              className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <Icon name="plus" />
              {t("สร้างรายวิชา", "Create Course")}
            </button>
          </div>
        </form>
      </main>
  );
}
