"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useCLOs, CLO } from "@/lib/clo";
import { useLanguage } from "@/context/LanguageContext";
import Modal from "@/components/Modal";
import { useAssignments } from "@/lib/assignments";
import { cloLinks } from "@/lib/cloLinks";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
export default function CLOPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getCLOsByCourse, addCLO, updateCLO, removeCLO } = useCLOs();

  const CONFIRM_CANCEL = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการยกเลิกหรือไม่?", "Changes will not be saved.\nCancel editing?");

  const course = getCourse(id);
  const clos = getCLOsByCourse(id);

  // Which assignments mention each CLO (names only — no criteria, no scores, since 15/10/2569)
  const { getAssignmentsByCourse, rubrics } = useAssignments();
  const linked = cloLinks({ clos, assignments: getAssignmentsByCourse(id), rubrics });

  // which CLO cards have their "linked assignments" dropdown open — all closed to start with
  const [openLinks, setOpenLinks] = useState<Set<string>>(() => new Set());
  const toggleLinks = (cloId: string) => setOpenLinks((prev) => { const next = new Set(prev); if (next.has(cloId)) next.delete(cloId); else next.add(cloId); return next; });

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
        <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
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
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <Icon name="chevron-left" />
          {t("กลับหน้าวิชา", "Back to course")}
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ผลลัพธ์การเรียนรู้รายวิชา (CLO)", "Course Learning Outcomes (CLO)")}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold shadow-sm active:scale-[0.98] transition-all shrink-0"
          >
            <Icon name="plus" />
            {t("เพิ่ม CLO", "Add CLO")}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl mb-8">
          {t(
            "สิ่งที่นักศึกษาควรทำได้เมื่อเรียนจบวิชานี้ ใช้ผูกกับเกณฑ์การให้คะแนนของแต่ละชิ้นงาน",
            "What a student should be able to do after completing this course — linked to each assignment's grading criteria."
          )}
        </p>

        {showEmpty ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-14 text-center">
            <IconTile icon="clipboard-list" size="lg" tone="accent" className="mx-auto mb-4" />
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มี CLO กำหนดไว้", "No CLOs defined yet")}</p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">{t("เพิ่ม CLO แล้วผูกกับเกณฑ์การให้คะแนนของแต่ละชิ้นงาน", "Add CLOs, then link them to each assignment's grading criteria")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <Icon name="plus" />
              {t("เพิ่ม CLO แรก", "Add First CLO")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {clos.map((clo) => {
                const res = linked.find((r) => r.clo.id === clo.id);
                return (
                <div
                  key={clo.id}
                  className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-bold font-mono tabular-nums">
                      {clo.code}
                    </span>
                    <p className="flex-1 min-w-0 text-sm text-[var(--text-primary)] leading-relaxed pt-0.5">{clo.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton icon="edit" label={t(`แก้ไข ${clo.code}`, `Edit ${clo.code}`)} onClick={() => openEdit(clo)} />
                      <IconButton icon="trash" label={t(`ลบ ${clo.code}`, `Delete ${clo.code}`)} tone="danger" onClick={() => handleDelete(clo)} />
                    </div>
                  </div>

                  {/* The assignments that mention this CLO — a dropdown, closed until asked for (21/10/2569); one line each, no criteria, no scores */}
                  <div className="mt-4 border-t border-[var(--border-subtle)] pt-3" data-testid={`clo-links-${clo.code}`}>
                    <button
                      type="button"
                      onClick={() => toggleLinks(clo.id)}
                      aria-expanded={openLinks.has(clo.id)}
                      aria-controls={`clo-links-panel-${clo.id}`}
                      data-testid={`clo-links-toggle-${clo.code}`}
                      className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                    >
                      <Icon name="chevron-right" size="sm" className={`shrink-0 transition-transform ${openLinks.has(clo.id) ? "rotate-90" : ""}`} />
                      {t("งานที่เกี่ยวข้องกับ CLO นี้", "Assignments linked to this CLO")}
                      <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 tabular-nums text-[var(--text-muted)]">{res?.assignments.length ?? 0}</span>
                    </button>
                    {openLinks.has(clo.id) && (
                      <div id={`clo-links-panel-${clo.id}`} className="mt-2">
                        {res && res.assignments.length > 0 ? (
                          <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                            {res.assignments.map((a) => (
                              <li key={a.id} className="px-3 py-2 text-sm">
                                <Link href={`/teacher/courses/${id}/assignments/${a.id}`} className="font-medium text-[var(--accent)] hover:underline">{a.name}</Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p data-testid="clo-unmeasured" className="text-xs leading-relaxed text-[var(--text-secondary)]">
                            {t("ยังไม่มีงานใดกล่าวถึง CLO นี้ — เลือก CLO ในส่วน Rubric ตอนสร้างหรือแก้ไขชิ้นงาน", "No assignment mentions this CLO yet — pick it in a criterion's CLO row when you create or edit an assignment's rubric")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-4 text-right">{clos.length} CLO</p>
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
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t("รหัส", "Code")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <input
                autoFocus
                value={formCode}
                onChange={e => setFormCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="CLO1"
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t("ข้อความ CLO", "CLO Text")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <textarea
                value={formText}
                onChange={e => setFormText(e.target.value)}
                placeholder="นักศึกษาสามารถ..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>
          </div>
        </Modal>
      </main>
  );
}
