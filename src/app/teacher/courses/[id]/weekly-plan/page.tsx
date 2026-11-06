"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useWeeklyPlan, WeeklyPlanItem } from "@/lib/weeklyPlan";
import { useLanguage } from "@/context/LanguageContext";
import { WEEKLY_PLAN_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
export default function WeeklyPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getWeeklyPlanByCourse, addWeeklyPlanItem, updateWeeklyPlanItem, removeWeeklyPlanItem } = useWeeklyPlan();

  useEffect(() => {
    if (WEEKLY_PLAN_DISABLED) router.replace(`/teacher/courses/${id}`);
  }, [router, id]);

  const CONFIRM_LEAVE = t("มีข้อมูลที่ยังไม่ได้บันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Unsaved changes.\nLeave this page?");
  const CONFIRM_CANCEL = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการยกเลิกหรือไม่?", "Changes will not be saved.\nCancel editing?");

  const course = getCourse(id);
  const items = getWeeklyPlanByCourse(id);

  const [formMode, setFormMode] = useState<"idle" | "add" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWeek, setFormWeek] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const formDirty = formMode !== "idle" && (formTopic !== "" || formNotes !== "");

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty]);

  function navAway(to: string) {
    if (formDirty && !window.confirm(CONFIRM_LEAVE)) return;
    router.push(to);
  }

  function openAdd() {
    if (formMode !== "idle" && formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setEditingId(null);
    const nextWeek = items.length > 0 ? Math.max(...items.map(i => i.week)) + 1 : 1;
    setFormWeek(String(nextWeek));
    setFormTopic("");
    setFormNotes("");
    setFormMode("add");
  }

  function openEdit(item: WeeklyPlanItem) {
    if (formMode !== "idle" && formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setEditingId(item.id);
    setFormWeek(String(item.week));
    setFormTopic(item.topic);
    setFormNotes(item.notes ?? "");
    setFormMode("edit");
  }

  function cancelForm() {
    if (formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setFormMode("idle");
    setEditingId(null);
  }

  function handleSave() {
    const week = Number(formWeek);
    const topic = formTopic.trim();
    if (!Number.isFinite(week) || week <= 0 || !topic) return;
    if (formMode === "add") {
      addWeeklyPlanItem({ courseId: id, week, topic, notes: formNotes.trim() || undefined });
    } else if (formMode === "edit" && editingId) {
      updateWeeklyPlanItem(editingId, { week, topic, notes: formNotes.trim() || undefined });
    }
    setFormMode("idle");
    setEditingId(null);
  }

  function handleDelete(item: WeeklyPlanItem) {
    if (!window.confirm(t(`ลบแผนสัปดาห์ที่ ${item.week} ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete week ${item.week}'s plan? Cannot be undone.`))) return;
    removeWeeklyPlanItem(item.id);
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  if (WEEKLY_PLAN_DISABLED) return null;

  const isFormValid = formTopic.trim().length > 0 && Number(formWeek) > 0;
  const showEmpty = items.length === 0 && formMode === "idle";

  return (
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
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("แผนการสอนรายสัปดาห์", "Weekly Teaching Plan")}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{course.name}</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors mt-1"
          >
            <Icon name="plus" />
            {t("เพิ่มสัปดาห์", "Add Week")}
          </button>
        </div>

        {/* Empty state */}
        {showEmpty ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-14 text-center">
            <IconTile icon="calendar" size="lg" tone="accent" className="mx-auto mb-4" />
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีแผนการสอน", "No weekly plan yet")}</p>
            <p className="text-xs text-[var(--text-secondary)] mb-6">{t("เพิ่มแผนรายสัปดาห์ให้นักศึกษาเห็นว่าจะเรียนอะไรบ้าง", "Add a weekly plan so students know what's coming up")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              {t("เพิ่มสัปดาห์แรก", "Add First Week")}
            </button>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={[
                  "flex items-start gap-4 py-4 px-4 transition-colors",
                  idx < items.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                  editingId === item.id ? "bg-[var(--accent-subtle)] opacity-60" : "hover:bg-[var(--bg-subtle)]/50",
                ].join(" ")}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-bold tabular-nums mt-0.5">
                  {t(`W${item.week}`, `W${item.week}`)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{item.topic}</p>
                  {item.notes && <p className="text-xs text-[var(--text-secondary)] mt-1">{item.notes}</p>}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <IconButton icon="edit" label={t("แก้ไข", "Edit")} onClick={() => openEdit(item)} disabled={editingId === item.id} />
                  <IconButton icon="trash" label={t("ลบ", "Delete")} tone="danger" onClick={() => handleDelete(item)} />
                </div>
              </div>
            ))}

            {formMode !== "idle" && (
              <div className="border-t-2 border-[var(--accent)]/20 bg-[var(--accent-subtle)]/40 p-6">
                <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">
                  {formMode === "add" ? t("เพิ่มแผนสัปดาห์ใหม่", "Add New Week") : t("แก้ไขแผนสัปดาห์", "Edit Week")}
                </p>
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "96px 1fr" }}>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      {t("สัปดาห์ที่", "Week")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <input
                      type="number" min={1}
                      value={formWeek}
                      onChange={e => setFormWeek(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      {t("หัวข้อที่สอน", "Topic")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <textarea
                      value={formTopic}
                      onChange={e => setFormTopic(e.target.value)}
                      placeholder="เช่น พื้นฐานภาษา Python"
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t("หมายเหตุ (ถ้ามี)", "Notes (optional)")}</label>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="เช่น แจกโจทย์แบบฝึกหัด, เตรียมสอบ ฯลฯ"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isFormValid}
                    className="px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("บันทึก", "Save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {items.length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-3 text-right">{t(`${items.length} สัปดาห์`, `${items.length} week(s)`)}</p>
        )}
      </main>
  );
}
