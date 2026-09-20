"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useCohortStudents, CohortStudent } from "@/lib/cohort-students";
import { getInitials } from "@/lib/utils";

/**
 * Teacher: enrol ONE student in a course by student ID. Same rule as the CSV
 * import — the ID must already exist in the system's student database (the
 * name/email come from there, not from what the teacher types), and a student
 * can't be enrolled twice. Mount it when opening, unmount on close (state resets).
 */
export default function EnrollStudentModal({ courseId, courseName, onClose }: {
  courseId: string;
  courseName: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addStudents, getStudentsByCourse } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState<CohortStudent | null>(null);

  const trimmed = studentId.trim();
  const match = trimmed ? findByStudentId(trimmed) : undefined;
  const alreadyEnrolled = !!match && getStudentsByCourse(courseId).some((s) => s.studentId === trimmed);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) { setError(t("กรุณากรอกรหัสนักศึกษา", "Student ID is required")); return; }
    if (!match) { setError(t("ไม่พบรหัสนี้ในระบบ — ให้แอดมินเพิ่มนักศึกษาเข้าระบบก่อน", "This ID isn't in the system — ask an admin to add the student first")); return; }
    if (alreadyEnrolled) { setError(t("นักศึกษาคนนี้ลงทะเบียนในวิชานี้แล้ว", "This student is already enrolled in this course")); return; }
    // No enrollmentStatus: the provider marks a newcomer to a non-empty roster "added-midterm" (meeting 4/9/2569)
    addStudents(courseId, [{
      studentId: match.studentId,
      firstName: match.firstName,
      lastName: match.lastName,
      email: match.email,
      cohort: match.cohort,
    }]);
    setAdded(match);
  }

  const fieldClass = "h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]";
  const secondaryBtn = "h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primaryBtn = "h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t("เพิ่มนักศึกษา", "Add Student")}
      description={t(`เข้าวิชา ${courseName} — ระบบจะดึงชื่อและอีเมลจากฐานข้อมูลนักศึกษา`, `To ${courseName} — the name and email come from the student database`)}
    >
      {added ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p role="status" className="text-sm font-semibold text-[var(--text-primary)]">
            {t(`เพิ่ม ${added.firstName} ${added.lastName} เข้าวิชาแล้ว`, `${added.firstName} ${added.lastName} was added to the course`)}
          </p>
          <p className="text-xs text-[var(--text-secondary)] tabular-nums">{added.studentId}</p>
          <div className="flex gap-2 mt-2">
            <button type="button" className={secondaryBtn} onClick={() => { setAdded(null); setStudentId(""); setError(""); }}>
              {t("เพิ่มอีกคน", "Add another")}
            </button>
            <button type="button" className={primaryBtn} onClick={onClose}>{t("เสร็จสิ้น", "Done")}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="enroll-sid" className="text-sm font-medium text-[var(--text-primary)]">
              {t("รหัสนักศึกษา", "Student ID")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              id="enroll-sid"
              type="text"
              inputMode="numeric"
              autoFocus
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setError(""); }}
              placeholder="64070501"
              aria-invalid={!!error}
              aria-describedby="enroll-sid-result"
              className={`${fieldClass} tabular-nums`}
            />
            <div id="enroll-sid-result" aria-live="polite">
              {error ? (
                <p role="alert" className="text-xs text-[var(--s-err-text)]">{error}</p>
              ) : match && alreadyEnrolled ? (
                <p className="text-xs text-[var(--s-warn-text)]">
                  {t(`${match.firstName} ${match.lastName} ลงทะเบียนในวิชานี้แล้ว`, `${match.firstName} ${match.lastName} is already enrolled in this course`)}
                </p>
              ) : null}
            </div>
          </div>

          {/* The student the ID resolves to — confirm it's the right person before adding */}
          {match && !alreadyEnrolled && !error && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-bold flex items-center justify-center shrink-0">
                {getInitials(`${match.firstName} ${match.lastName}`)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{match.title ? `${match.title} ` : ""}{match.firstName} {match.lastName}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{match.email}</p>
                <p className="text-xs text-[var(--text-secondary)]">{[match.cohort, match.program].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={secondaryBtn} onClick={onClose}>{t("ยกเลิก", "Cancel")}</button>
            <button type="submit" className={primaryBtn} disabled={alreadyEnrolled}>
              {t("เพิ่มนักศึกษา", "Add Student")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
