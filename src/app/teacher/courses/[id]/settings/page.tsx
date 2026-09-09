"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useCourses, PRESET_COLORS, type GradingSource, type PublishMode } from "@/lib/courses";
import { useLanguage } from "@/context/LanguageContext";
import { CourseIcon, COURSE_ICON_KEYS, type CourseIconKey } from "@/components/CourseIcon";

export default function CourseSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse, updateCourse, removeCourse } = useCourses();
  const CONFIRM_MSG = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Unsaved changes.\nLeave this page?");
  const course = getCourse(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<CourseIconKey>("book");
  const [gradingSource, setGradingSource] = useState<GradingSource>("ta");
  const [publishMode, setPublishMode] = useState<PublishMode>("manual");
  const [saved, setSaved] = useState(false);
  const originalRef = useRef({ name: "", description: "", coverColor: "", icon: "book" as CourseIconKey, gradingSource: "ta" as GradingSource, publishMode: "manual" as PublishMode });

  useEffect(() => {
    if (course) {
      const orig = {
        name: course.name,
        description: course.description ?? "",
        coverColor: course.coverColor ?? PRESET_COLORS[0],
        icon: course.icon ?? ("book" as CourseIconKey),
        gradingSource: course.gradingSource ?? ("ta" as GradingSource),
        publishMode: course.publishMode ?? ("manual" as PublishMode),
      };
      setName(orig.name);
      setDescription(orig.description);
      setCoverColor(orig.coverColor);
      setIcon(orig.icon);
      setGradingSource(orig.gradingSource);
      setPublishMode(orig.publishMode);
      originalRef.current = orig;
    }
  }, [course?.id]);

  const isDirty =
    !saved && (
      name !== originalRef.current.name ||
      description !== originalRef.current.description ||
      coverColor !== originalRef.current.coverColor ||
      icon !== originalRef.current.icon ||
      gradingSource !== originalRef.current.gradingSource ||
      publishMode !== originalRef.current.publishMode
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
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
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
      gradingSource,
      publishMode,
    });
    setSaved(true);
    setTimeout(() => router.push(`/teacher/courses/${id}`), 800);
  }

  function handleArchive() {
    if (!confirm(t(`Archive "${course?.name}"? คุณสามารถ restore ได้ภายหลัง`, `Archive "${course?.name}"? You can restore it later.`))) return;
    updateCourse(id, { status: "archived" });
    router.push("/teacher/courses");
  }

  function handleDelete() {
    if (!confirm(t(`ลบ "${course?.name}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${course?.name}"? Cannot be undone.`))) return;
    removeCourse(id);
    router.push("/teacher/courses");
  }

  const isValid = name.trim().length > 0;

  return (
      <main className="w-full max-w-[860px] mx-auto px-8 py-8">
        {/* Back */}
        <button onClick={() => navAway("/teacher/courses")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับไปหน้ารายวิชา", "Back to All Courses")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("แก้ไขรายวิชา", "Edit Existing Course")}</h1>

        <form onSubmit={handleSave} className="space-y-6">
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </section>

          {/* Course Visuals */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{t("รูปแบบรายวิชา", "Course Visuals")}</h2>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* Icon Picker */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2 self-start">{t("ไอคอน", "Icon")}</label>
                <div className="w-16 h-16 rounded-xl mb-3 shadow flex items-center justify-center" style={{ background: coverColor }}>
                  <CourseIcon iconKey={icon} size={26} className="text-white" />
                </div>
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
                          ? "border-[#1B2A4A] text-[var(--text-primary)] scale-110"
                          : "border-transparent text-gray-400 hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      <CourseIcon iconKey={k} size={15} />
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
                    <CourseIcon iconKey={icon} size={14} className="text-white" />
                  </div>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{name || t("ชื่อรายวิชา", "Course Name")}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t("เพิ่มด้วยตนเอง", "Manually Added")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Grading & Publishing */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{t("การตรวจและประกาศคะแนน", "Grading & Publishing")}</h2>

            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("แหล่งคะแนน", "Grading Source")}</label>
              <p className="text-xs text-gray-500 mb-2.5">{t("เลือกว่าคะแนนของวิชานี้มาจากใครเป็นหลัก", "Choose who grades submissions in this section by default.")}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "ta" as GradingSource, label: t("TA ตรวจ", "TA-graded") },
                  { key: "ai" as GradingSource, label: t("AI ตรวจ", "AI-graded") },
                  { key: "blind" as GradingSource, label: t("Blind Test", "Blind Test") },
                ]).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setGradingSource(opt.key)}
                    aria-pressed={gradingSource === opt.key}
                    className={[
                      "px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                      gradingSource === opt.key
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("การประกาศคะแนน", "Publishing")}</label>
              <p className="text-xs text-gray-500 mb-2.5">{t("ประกาศคะแนนให้นักศึกษาเห็นทันทีหลังตรวจเสร็จ หรือรอให้อาจารย์กด approve ก่อน", "Show scores to students right after grading, or hold them until you approve.")}</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "auto" as PublishMode, label: t("ประกาศอัตโนมัติ", "Auto-publish") },
                  { key: "manual" as PublishMode, label: t("รอ Approve", "Wait for approval") },
                ]).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setPublishMode(opt.key)}
                    aria-pressed={publishMode === opt.key}
                    className={[
                      "px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                      publishMode === opt.key
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-white rounded-2xl border border-[var(--s-err-bd)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--s-err-text)] uppercase tracking-wider mb-4">{t("โซนอันตราย", "Danger Zone")}</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleArchive}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
              >
                {t("จัดเก็บรายวิชา", "Archive Course")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--s-err-bd)] text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
              >
                {t("ลบถาวร", "Delete Permanently")}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">{t("Archive จะซ่อนรายวิชา — สามารถ restore ได้ภายหลัง. Delete จะลบถาวร", "Archive hides the course — you can restore it later. Delete is permanent.")}</p>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway(`/teacher/courses/${id}`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={[
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                saved ? "bg-emerald-500 text-white" : "bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] disabled:opacity-40 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {saved ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
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
