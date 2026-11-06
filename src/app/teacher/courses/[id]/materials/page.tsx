"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useTeachingMaterials, TeachingMaterial, TeachingMaterialType } from "@/lib/teachingMaterials";
import { storeFile, resolveFileUrl, FileTooLargeError, MAX_FILE_MB } from "@/lib/fileStorage";
import { useLanguage } from "@/context/LanguageContext";
import { MATERIALS_DISABLED } from "@/lib/featureFlags";

import Icon, { type IconName } from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
const TYPE_ICON: Record<TeachingMaterialType, IconName> = {
  link: "link",
  file: "file",
  recording: "video",
};

export default function TeachingMaterialsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getMaterialsByCourse, addMaterial, removeMaterial } = useTeachingMaterials();

  useEffect(() => {
    if (MATERIALS_DISABLED) router.replace(`/teacher/courses/${id}`);
  }, [router, id]);

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
        setUploadError(t(`ไฟล์ใหญ่เกินไป (จำกัด ${MAX_FILE_MB}MB)`, `File too large (${MAX_FILE_MB}MB limit)`));
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
        <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  if (MATERIALS_DISABLED) return null;

  const showEmpty = materials.length === 0 && !formOpen;

  return (
      <main className="w-full px-8 py-10">

        <button
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <Icon name="chevron-left" />
          {t("กลับหน้าวิชา", "Back to course")}
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("สื่อการสอน", "Teaching Materials")}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors mt-1"
          >
            <Icon name="plus" />
            {t("เพิ่มสื่อการสอน", "Add Material")}
          </button>
        </div>

        {showEmpty ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-14 text-center">
            <IconTile icon="file" size="lg" tone="accent" className="mx-auto mb-4" />
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีสื่อการสอน", "No teaching materials yet")}</p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">{t("แนบลิงก์ เอกสาร หรือบันทึกการสอนให้นักศึกษาเข้าถึงได้", "Attach links, documents, or recordings for students")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              {t("เพิ่มสื่อแรก", "Add First Material")}
            </button>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
            {materials.map((m, idx) => (
              <div
                key={m.id}
                className={[
                  "flex items-center gap-3 py-3.5 px-4 transition-colors hover:bg-[var(--bg-subtle)]/50",
                  idx < materials.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                <IconTile icon={TYPE_ICON[m.type]} size="sm" />
                <button onClick={() => openMaterial(m)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate hover:text-[var(--accent)] transition-colors">{m.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{TYPE_LABEL[m.type]}{m.source === "upload" ? ` · ${t("อัปโหลด", "uploaded")}` : ""}</p>
                </button>
                <IconButton icon="trash" label={t("ลบ", "Delete")} tone="danger" onClick={() => handleDelete(m)} />
              </div>
            ))}

            {formOpen && (
              <div className="border-t-2 border-[var(--accent)]/20 bg-[var(--accent-subtle)]/40 p-6">
                <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">{t("เพิ่มสื่อการสอน", "Add Teaching Material")}</p>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    {t("ชื่อสื่อ", "Title")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="เช่น สไลด์บทที่ 1"
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">{t("ประเภท", "Type")}</label>
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
                            : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--bg-nav)] hover:text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        {TYPE_LABEL[tp]}
                      </button>
                    ))}
                  </div>
                </div>

                {type === "file" ? (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t("ไฟล์", "File")} <span className="text-[var(--s-err-text)]">*</span></label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="w-full text-sm text-[var(--text-secondary)] file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-[var(--accent-solid)] file:text-[var(--accent-solid-text)] file:text-sm file:font-medium hover:file:bg-[var(--accent-solid-hover)] file:cursor-pointer disabled:opacity-50"
                    />
                    {uploadError && <p className="text-xs text-[var(--s-err-text)] mt-1.5">{uploadError}</p>}
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">{t(`จำกัดไฟล์ไม่เกิน ${MAX_FILE_MB}MB`, `${MAX_FILE_MB}MB limit`)}</p>
                  </div>
                ) : (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      {t("ลิงก์", "URL")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <input
                      value={urlValue}
                      onChange={e => setUrlValue(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
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
          <p className="text-xs text-[var(--text-secondary)] mt-3 text-right">{t(`${materials.length} รายการ`, `${materials.length} item(s)`)}</p>
        )}
      </main>
  );
}
