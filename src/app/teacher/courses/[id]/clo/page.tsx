"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useCLOs, CLO } from "@/lib/clo";
import { useLanguage } from "@/context/LanguageContext";
import Modal from "@/components/Modal";

export default function CLOPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getCLOsByCourse, addCLO, updateCLO, removeCLO } = useCLOs();

  const CONFIRM_CANCEL = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการยกเลิกหรือไม่?", "Changes will not be saved.\nCancel editing?");

  const course = getCourse(id);
  const clos = getCLOsByCourse(id);

  const [formMode, setFormMode] = useState<"idle" | "add" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formText, setFormText] = useState("");

  const formDirty = formMode !== "idle" && (formCode !== "" || formText !== "");

  // Modal owns Esc/backdrop-close; this only guards a hard page navigation mid-edit.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty]);

  function navAway(to: string) {
    if (formDirty && !window.confirm(t("มีข้อมูลที่ยังไม่ได้บันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Unsaved changes.\nLeave this page?"))) return;
    router.push(to);
  }

  function openAdd() {
    setEditingId(null);
    setFormCode(`CLO${clos.length + 1}`);
    setFormText("");
    setFormMode("add");
  }

  function openEdit(clo: CLO) {
    setEditingId(clo.id);
    setFormCode(clo.code);
    setFormText(clo.text);
    setFormMode("edit");
  }

  function closeForm() {
    if (formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setFormMode("idle");
    setEditingId(null);
  }

  function handleSave() {
    const code = formCode.trim();
    const text = formText.trim();
    if (!code || !text) return;
    if (formMode === "add") {
      addCLO({ courseId: id, code, text });
    } else if (formMode === "edit" && editingId) {
      updateCLO(editingId, { code, text });
    }
    setFormMode("idle");
    setEditingId(null);
  }

  function handleDelete(clo: CLO) {
    if (!window.confirm(t(`ลบ "${clo.code}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${clo.code}"? Cannot be undone.`))) return;
    removeCLO(clo.id);
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-sm text-gray-500">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  const isFormValid = formCode.trim().length > 0 && formText.trim().length > 0;
  const showEmpty = clos.length === 0;

  return (
      // Full-bleed like the other course pages (23/9/2569 — the page frame matches its siblings;
      // the CLO content itself is capped where it needs to be, not the whole page).
      <main className="w-full px-8 py-10">

        {/* Back */}
        <button
          onClick={() => navAway(`/teacher/courses/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับหน้าวิชา", "Back to course")}
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ผลลัพธ์การเรียนรู้รายวิชา (CLO)", "Course Learning Outcomes (CLO)")}</h1>
            <p className="text-sm text-gray-500">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold shadow-sm active:scale-[0.98] transition-all shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            {t("เพิ่ม CLO", "Add CLO")}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl mb-8">
          {t(
            "สิ่งที่นักศึกษาควรทำได้เมื่อเรียนจบวิชานี้ ใช้เป็นฐานสำหรับวัด CLO Attainment และผูกกับเกณฑ์การให้คะแนนของแต่ละชิ้นงาน",
            "What a student should be able to do after completing this course — the basis for measuring CLO Attainment and linking to each assignment's grading criteria."
          )}
        </p>

        {showEmpty ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มี CLO กำหนดไว้", "No CLOs defined yet")}</p>
            <p className="text-xs text-gray-500 mb-6">{t("เพิ่ม CLO เพื่อวัดผลลัพธ์การเรียนรู้และ CLO Attainment ของนักศึกษา", "Add CLOs to measure student learning outcomes and CLO Attainment")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("เพิ่ม CLO แรก", "Add First CLO")}
            </button>
          </div>
        ) : (
          <>
            {/* One page-level note instead of repeating the same warning on every card — CLO↔criteria
                linking isn't built yet (deferred, tracked since 19/9), so it's true of all of them at
                once, not a per-CLO fact worth saying 4 times over. */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs text-amber-700 leading-relaxed">
                {t("ยังไม่รองรับการผูก CLO เข้ากับเกณฑ์การให้คะแนนของชิ้นงาน — เป็นฟีเจอร์ที่วางแผนไว้ในอนาคต", "Linking a CLO to an assignment's grading criteria isn't available yet — planned for a future release")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {clos.map((clo) => (
                <div
                  key={clo.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-lg bg-teal-50 text-[var(--accent)] text-xs font-bold font-mono tabular-nums">
                      {clo.code}
                    </span>
                    <p className="flex-1 min-w-0 text-sm text-[var(--text-primary)] leading-relaxed pt-0.5">{clo.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(clo)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors"
                        title={t("แก้ไข", "Edit")}
                        aria-label={t(`แก้ไข ${clo.code}`, `Edit ${clo.code}`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(clo)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
                        title={t("ลบ", "Delete")}
                        aria-label={t(`ลบ ${clo.code}`, `Delete ${clo.code}`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-4 text-right">{clos.length} CLO</p>
          </>
        )}

        {/* Add / Edit — a centred popup like every other form in this app (DESIGN.md §9a), was
            an inline panel appended under the table; that was the one form left behind when the
            rest of the app converted to Modal. */}
        <Modal
          open={formMode !== "idle"}
          onClose={closeForm}
          title={formMode === "add" ? t("เพิ่ม CLO ใหม่", "Add New CLO") : t(`แก้ไข ${editingId ? clos.find(c => c.id === editingId)?.code ?? "" : ""}`, `Edit ${editingId ? clos.find(c => c.id === editingId)?.code ?? "" : ""}`)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={closeForm}
                className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isFormValid}
                className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("บันทึก", "Save")}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("รหัส", "Code")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <input
                autoFocus
                value={formCode}
                onChange={e => setFormCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="CLO1"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("ข้อความ CLO", "CLO Text")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <textarea
                value={formText}
                onChange={e => setFormText(e.target.value)}
                placeholder={t("นักศึกษาสามารถ...", "Students can...")}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </div>
        </Modal>
      </main>
  );
}
