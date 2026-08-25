"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers, ManagedTeacher } from "@/lib/managed-teachers";

function AddTeacherDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addTeacher, teachers } = useManagedTeachers();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "ta">("teacher");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = t("กรุณากรอกชื่อ", "Name is required");
    if (!email.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    else if (teachers.some((tc) => tc.email === email.trim().toLowerCase()))
      e.email = t("อีเมลนี้มีในระบบแล้ว", "This email already exists");
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    addTeacher({ name: name.trim(), email: email.trim().toLowerCase(), role });
    setLoading(false);
    setName(""); setEmail(""); setRole("teacher"); setErrors({});
    onClose();
  }

  // Close drawer on Escape (component only mounts when open=true)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("เพิ่มอาจารย์", "Add Teacher")}
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("เพิ่มอาจารย์", "Add Teacher")}</h2>
          <button
            onClick={onClose}
            aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 gap-5 px-5 py-5 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-name" className="text-sm font-medium text-[var(--text-primary)]">
              {t("ชื่อ-นามสกุล", "Full Name")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="teacher-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder={t("เช่น ดร.สมชาย ใจดี", "e.g. Dr. John Smith")}
              aria-describedby={errors.name ? "teacher-name-err" : undefined}
              aria-invalid={!!errors.name}
              aria-required="true"
              autoFocus
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
            {errors.name && <p id="teacher-name-err" role="alert" className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-email" className="text-sm font-medium text-[var(--text-primary)]">
              {t("อีเมล", "Email")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="teacher@kmitl.ac.th"
              aria-describedby={errors.email ? "teacher-email-err" : undefined}
              aria-invalid={!!errors.email}
              aria-required="true"
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
            {errors.email && <p id="teacher-email-err" role="alert" className="text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-role" className="text-sm font-medium text-[var(--text-primary)]">{t("ตำแหน่ง", "Role")}</label>
            <select
              id="teacher-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "ta")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              <option value="teacher">{t("อาจารย์", "Teacher")}</option>
              <option value="ta">{t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)")}</option>
            </select>
          </div>

          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {loading ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มอาจารย์", "Add Teacher")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ConfirmDeleteDialog({
  teacher,
  onConfirm,
  onCancel,
}: {
  teacher: ManagedTeacher;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape (component only mounts when visible)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการลบ", "Confirm Delete")}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t(`ลบ "${teacher.name}" ออกจากระบบ?`, `Remove "${teacher.name}" from system?`)}
            </p>
            {teacher.courseIds.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {t(
                  `อาจารย์นี้ถูก assign ใน ${teacher.courseIds.length} รายวิชา`,
                  `This teacher is assigned to ${teacher.courseIds.length} course(s)`
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
          >
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
          >
            {t("ลบ", "Delete")}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminTeachersPage() {
  const { t } = useLanguage();
  const { teachers, removeTeacher } = useManagedTeachers();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deletingTeacher = teachers.find((tp) => tp.id === deletingId);

  const ROLE_LABELS: Record<"teacher" | "ta", string> = {
    teacher: t("อาจารย์", "Teacher"),
    ta: t("ผู้ช่วยสอน", "TA"),
  };

  return (
    <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("จัดการอาจารย์", "Teacher Management")}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {t(`อาจารย์ทั้งหมด ${teachers.length} คน`, `${teachers.length} teacher(s) in system`)}
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("เพิ่มอาจารย์", "Add Teacher")}
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีอาจารย์ในระบบ", "No teachers yet")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">{t("เพิ่มอาจารย์คนแรกเพื่อเริ่มต้น", "Add the first teacher to get started")}</p>
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {t("เพิ่มอาจารย์", "Add Teacher")}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ชื่อ", "Name")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ตำแหน่ง", "Role")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รายวิชา", "Courses")}</th>
                  <th scope="col" className="px-4 py-3 w-12"><span className="sr-only">{t("การจัดการ", "Actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, i) => (
                  <tr
                    key={teacher.id}
                    className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] transition-colors ${i % 2 === 1 ? "bg-[var(--bg-app)]" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#2DD4BF]/20 flex items-center justify-center text-[#0F766E] text-xs font-bold shrink-0 select-none" aria-hidden="true">
                          {teacher.name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase()}
                        </div>
                        {teacher.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{teacher.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        teacher.role === "teacher"
                          ? "bg-[#2DD4BF]/10 text-[#0F766E]"
                          : "bg-[#A78BFA]/10 text-[#7C3AED]"
                      }`}>
                        {ROLE_LABELS[teacher.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] font-variant-numeric tabular-nums">
                      {teacher.courseIds.length}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeletingId(teacher.id)}
                        aria-label={t(`ลบ ${teacher.name}`, `Delete ${teacher.name}`)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <AddTeacherDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {deletingTeacher && (
        <ConfirmDeleteDialog
          teacher={deletingTeacher}
          onConfirm={() => { removeTeacher(deletingId!); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
