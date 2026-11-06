"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useCourses, PRESET_COLORS } from "@/lib/courses";
import { useCurriculum } from "@/lib/curriculum";
import { useLanguage } from "@/context/LanguageContext";
import { CourseIcon, COURSE_ICON_KEYS, type CourseIconKey } from "@/components/CourseIcon";
import CourseBanner from "@/components/CourseBanner";

import Icon from "@/components/Icon";
export default function CourseSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse, updateCourse } = useCourses();
  const { curriculumVersions, courseTemplates } = useCurriculum();
  const CONFIRM_MSG = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Unsaved changes.\nLeave this page?");
  const course = getCourse(id);
  const linkedTemplate = course?.courseTemplateId ? courseTemplates.find((ct) => ct.id === course.courseTemplateId) : undefined;
  const linkedCurriculum = linkedTemplate ? curriculumVersions.find((v) => v.id === linkedTemplate.curriculumVersionId) : undefined;
  const TERM_LABEL: Record<string, string> = { "1": t("เทอม 1", "Term 1"), "2": t("เทอม 2", "Term 2"), summer: t("ภาคฤดูร้อน", "Summer") };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<CourseIconKey>("book");
  const [saved, setSaved] = useState(false);
  const originalRef = useRef({ name: "", description: "", coverColor: "", icon: "book" as CourseIconKey });

  useEffect(() => {
    if (course) {
      const orig = {
        name: course.name,
        description: course.description ?? "",
        coverColor: course.coverColor ?? PRESET_COLORS[0],
        icon: course.icon ?? ("book" as CourseIconKey),
      };
      setName(orig.name);
      setDescription(orig.description);
      setCoverColor(orig.coverColor);
      setIcon(orig.icon);
      originalRef.current = orig;
    }
  }, [course?.id]);

  const isDirty =
    !saved && (
      name !== originalRef.current.name ||
      description !== originalRef.current.description ||
      coverColor !== originalRef.current.coverColor ||
      icon !== originalRef.current.icon
    );

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

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateCourse(id, {
      name: name.trim(),
      description: description.trim(),
      coverColor,
      iconColor: coverColor,
      icon,
    });
    setSaved(true);
    setTimeout(() => router.push(`/teacher/courses/${id}`), 800);
  }

  function handleArchive() {
    if (!confirm(t(`Archive "${course?.name}"? คุณสามารถ restore ได้ภายหลัง`, `Archive "${course?.name}"? You can restore it later.`))) return;
    updateCourse(id, { status: "archived" });
    router.push("/teacher/courses");
  }

  const isValid = name.trim().length > 0;

  return (
      <main className="w-full px-8 py-8">
        {/* Back */}
        <button onClick={() => navAway("/teacher/courses")} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] mb-6 transition-colors">
          <Icon name="chevron-left" />
          {t("กลับไปหน้ารายวิชา", "Back to All Courses")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("แก้ไขรายวิชา", "Edit Existing Course")}</h1>

        {/* Curriculum link — read-only, set only at course creation */}
        {linkedTemplate && (
          <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-subtle)]">
            <Icon name="graduation-cap" size="lg" className="text-[var(--accent)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {linkedTemplate.code} — {linkedTemplate.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {linkedCurriculum ? `${linkedCurriculum.program} — ${linkedCurriculum.label}` : t("หลักสูตรถูกลบไปแล้ว", "Curriculum version was removed")}
                {course.academicYear && ` · ${t("ปีการศึกษา", "AY")} ${course.academicYear}`}
                {course.term !== undefined && ` · ${TERM_LABEL[String(course.term)]}`}
                {course.sectionNumber && ` · ${t("กลุ่มเรียน", "Section")} ${course.sectionNumber}`}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </section>

          {/* Course Visuals */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5">{t("รูปแบบรายวิชา", "Course Visuals")}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
              {/* Pickers */}
              <div className="flex flex-col gap-6">
                {/* Icon Picker */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">{t("ไอคอน", "Icon")}</label>
                  <div className="flex flex-wrap gap-2">
                    {COURSE_ICON_KEYS.map((k) => (
                      <button
                        type="button"
                        key={k}
                        onClick={() => setIcon(k)}
                        aria-label={k}
                        aria-pressed={icon === k}
                        className={[
                          "w-9 h-9 rounded-lg border-2 flex items-center justify-center transition-all",
                          icon === k
                            ? "border-[var(--text-primary)] text-[var(--text-primary)] scale-110"
                            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border)]",
                        ].join(" ")}
                      >
                        <CourseIcon iconKey={k} size="md" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2.5">{t("สีปก", "Cover Color")}</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCoverColor(c)}
                        aria-label={c}
                        aria-pressed={coverColor === c}
                        className="w-9 h-9 rounded-lg border-2 transition-all"
                        style={{
                          background: c,
                          borderColor: coverColor === c ? "var(--text-primary)" : "transparent",
                          transform: coverColor === c ? "scale(1.1)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Live preview — reuses the real My Courses card banner (22/9/2569: was its own
                  hand-rolled swatch with the name in a separate white box below; now the code+name
                  sit up in the colour band itself, exactly like the actual card will render, same
                  contrast logic included). */}
              <div className="flex flex-col">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2.5">{t("ตัวอย่าง", "Preview")}</p>
                <div className="w-64 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-sm">
                  <CourseBanner coverColor={coverColor} icon={icon} name={name || t("ชื่อรายวิชา", "Course Name")} code={course.code} />
                </div>
              </div>
            </div>
          </section>

          {/* Danger Zone — Delete removed 22/9/2569: only admin can permanently delete a course now
              (admin/courses/page.tsx already has its own delete flow); teachers can still archive
              their own course (reversible) but no longer see a path to permanent deletion here. */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--s-warn-bd)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--st-todo-text)] uppercase tracking-wider mb-4">{t("โซนอันตราย", "Danger Zone")}</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleArchive}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--s-warn-bd)] text-[var(--st-todo-text)] hover:bg-[var(--st-todo-bg)] transition-colors"
              >
                {t("จัดเก็บรายวิชา", "Archive Course")}
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-3">{t("Archive จะซ่อนรายวิชา — สามารถ restore ได้ภายหลัง. การลบรายวิชาถาวรทำได้โดยแอดมินเท่านั้น", "Archive hides the course — you can restore it later. Permanently deleting a course is admin-only.")}</p>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway(`/teacher/courses/${id}`)}
              className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={[
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                saved ? "bg-[var(--s-ok-text)] text-white" : "bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {saved ? (
                <>
                  <Icon name="check" size="sm" />
                  {t("บันทึกแล้ว", "Saved")}
                </>
              ) : (
                t("บันทึกการเปลี่ยนแปลง", "Save Changes")
              )}
            </button>
          </div>
        </form>
      </main>
  );
}
