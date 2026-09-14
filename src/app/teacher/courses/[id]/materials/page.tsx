"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useTeachingMaterials, TeachingMaterial, TeachingMaterialType } from "@/lib/teachingMaterials";
import { storeFile, resolveFileUrl, FileTooLargeError } from "@/lib/fileStorage";
import { useLanguage } from "@/context/LanguageContext";

const TYPE_ICON: Record<TeachingMaterialType, React.ReactNode> = {
  link: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  recording: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
};

export default function TeachingMaterialsPage() {
  const { id } = useParams<{ id: string }>();
  useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getMaterialsByCourse, addMaterial, removeMaterial } = useTeachingMaterials();

  const TYPE_LABEL: Record<TeachingMaterialType, string> = {
    link: t("ลิงก์", "Link"),
    file: t("ไฟล์แนบ", "File"),
    recording: t("บันทึกการสอน", "Recording"),
  };

  const course = getCourse(id);
  const materials = getMaterialsByCourse(id);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TeachingMaterialType>("link");
  const [urlValue, setUrlValue] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function openAdd() {
    setTitle("");
    setType("link");
    setUrlValue("");
    setUploadError(null);
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setUploadError(null);
  }

  function handleAddLink() {
    const t_ = title.trim();
    const u = urlValue.trim();
    if (!t_ || !u) return;
    addMaterial({ courseId: id, title: t_, type, source: "url", ref: u });
    setFormOpen(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const t_ = title.trim() || file.name;
    setUploadError(null);
    setUploading(true);
    try {
      const key = await storeFile(file);
      addMaterial({ courseId: id, title: t_, type: "file", source: "upload", ref: key });
      setFormOpen(false);
    } catch (err) {
      if (err instanceof FileTooLargeError) {
        setUploadError(t("ไฟล์ใหญ่เกินไป (จำกัด 2MB สำหรับ mock storage)", "File too large (2MB mock storage limit)"));
      } else {
        setUploadError(t("อัปโหลดไม่สำเร็จ", "Upload failed"));
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleDelete(m: TeachingMaterial) {
    if (!window.confirm(t(`ลบ "${m.title}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${m.title}"? Cannot be undone.`))) return;
    removeMaterial(m.id);
  }

  function openMaterial(m: TeachingMaterial) {
    const href = m.source === "url" ? m.ref : resolveFileUrl(m.ref);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-sm text-gray-500">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  const showEmpty = materials.length === 0 && !formOpen;

  return (
      <main className="w-full px-8 py-10">

        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับหน้าวิชา", "Back to course")}
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("สื่อการสอน", "Teaching Materials")}</h1>
            <p className="text-sm text-gray-500">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors mt-1"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            {t("เพิ่มสื่อการสอน", "Add Material")}
          </button>
        </div>

        {showEmpty ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มีสื่อการสอน", "No teaching materials yet")}</p>
            <p className="text-xs text-gray-500 mb-6">{t("แนบลิงก์ เอกสาร หรือบันทึกการสอนให้นักศึกษาเข้าถึงได้", "Attach links, documents, or recordings for students")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              {t("เพิ่มสื่อแรก", "Add First Material")}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {materials.map((m, idx) => (
              <div
                key={m.id}
                className={[
                  "flex items-center gap-3 py-3.5 px-4 transition-colors hover:bg-gray-50/50",
                  idx < materials.length - 1 ? "border-b border-gray-50" : "",
                ].join(" ")}
              >
                <span className="shrink-0 w-9 h-9 rounded-xl bg-teal-50 text-[var(--accent)] flex items-center justify-center">
                  {TYPE_ICON[m.type]}
                </span>
                <button onClick={() => openMaterial(m)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate hover:text-[var(--accent)] transition-colors">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABEL[m.type]}{m.source === "upload" ? ` · ${t("อัปโหลด", "uploaded")}` : ""}</p>
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--s-err-bg)] text-gray-500 hover:text-[var(--s-err-text)] transition-colors"
                  title={t("ลบ", "Delete")}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}

            {formOpen && (
              <div className="border-t-2 border-[var(--accent)]/20 bg-teal-50/40 p-6">
                <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">{t("เพิ่มสื่อการสอน", "Add Teaching Material")}</p>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    {t("ชื่อสื่อ", "Title")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={t("เช่น สไลด์บทที่ 1", "e.g. Chapter 1 slides")}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 mb-2">{t("ประเภท", "Type")}</label>
                  <div className="flex gap-2">
                    {(["link", "file", "recording"] as TeachingMaterialType[]).map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => { setType(tp); setUploadError(null); }}
                        className={[
                          "px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-colors",
                          type === tp
                            ? "bg-[var(--bg-nav)] text-white border-[var(--bg-nav)]"
                            : "border-gray-200 text-gray-500 hover:border-[var(--bg-nav)] hover:text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        {TYPE_LABEL[tp]}
                      </button>
                    ))}
                  </div>
                </div>

                {type === "file" ? (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("ไฟล์", "File")} <span className="text-[var(--s-err-text)]">*</span></label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="w-full text-sm text-gray-500 file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-[var(--accent-solid)] file:text-[var(--accent-solid-text)] file:text-sm file:font-medium hover:file:bg-[var(--accent-solid-hover)] file:cursor-pointer disabled:opacity-50"
                    />
                    {uploadError && <p className="text-xs text-[var(--s-err-text)] mt-1.5">{uploadError}</p>}
                    <p className="text-xs text-gray-400 mt-1.5">{t("จำกัดไฟล์ไม่เกิน 2MB (mock storage)", "2MB limit (mock storage)")}</p>
                  </div>
                ) : (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {t("ลิงก์", "URL")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <input
                      value={urlValue}
                      onChange={e => setUrlValue(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  {type !== "file" && (
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!title.trim() || !urlValue.trim()}
                      className="px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("บันทึก", "Save")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {materials.length > 0 && (
          <p className="text-xs text-gray-500 mt-3 text-right">{t(`${materials.length} รายการ`, `${materials.length} item(s)`)}</p>
        )}
      </main>
  );
}
