"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";

export default function StudentClassworkDetailPage() {
  const { secId, actId } = useParams<{ secId: string; actId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, addSubmission, updateSubmission } = useAssignments();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const course = getCourse(secId);
  const assignment = getAssignment(actId);
  const allSubs = getSubmissionsByAssignment(actId);
  const mySubmission = allSubs.find(
    (s) => s.studentId === (user?.studentId ?? user?.email ?? "")
  );

  if (!course || !assignment) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t("ไม่พบข้อมูล", "Not found")}</div>
    );
  }

  const due = new Date(assignment.dueDate + "T23:59:59");
  const isPast = new Date() > due;
  const isGraded = mySubmission?.status === "graded";
  const score = mySubmission?.instructorScore ?? mySubmission?.aiScore ?? null;

  function handleSubmit() {
    setSubmitting(true);
    if (!mySubmission) {
      addSubmission({
        assignmentId: actId,
        studentId: user?.studentId ?? user?.email ?? "unknown",
        studentName: user?.name ?? "Unknown Student",
        email: user?.email ?? "",
        submittedAt: new Date().toISOString(),
        fileUrl: null,
        aiScore: null,
        instructorScore: null,
        instructorComment: "",
        externalUseConsent: false,
        status: "not_graded",
      });
    } else {
      updateSubmission(mySubmission.id, { status: "not_graded" });
    }
    setSubmitting(false);
    setConfirmOpen(false);
    setSubmitted(true);
  }

  const SUBMIT_BTN_LABEL = mySubmission
    ? t("ส่งอีกครั้ง", "Resubmit")
    : t("ส่งงาน", "Submit");

  return (
    <>
    <div className="p-6 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-5 flex-wrap">
          <Link href={`/student/courses/${secId}/classwork`} className="hover:text-[var(--text-primary)] transition-colors">
            {course.name}
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{assignment.name}</span>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Assignment info */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{assignment.name}</h1>
                <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  assignment.submissionType === "group"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-[#F97316]/10 text-[#C2410C]"
                }`}>
                  {assignment.submissionType === "group" ? t("งานกลุ่ม", "Group") : t("งานเดี่ยว", "Individual")}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span className={isPast && !mySubmission ? "text-[var(--s-err-text)] font-semibold" : ""}>
                    {t("กำหนดส่ง:", "Due:")} {due.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  {isPast && !mySubmission && (
                    <span className="text-[10px] font-bold text-[var(--s-err-text)] bg-[var(--s-err-bg)] px-1.5 py-0.5 rounded-full">
                      {t("เกินกำหนด", "Overdue")}
                    </span>
                  )}
                </span>
                <span className="text-[var(--text-muted)]">{t(`คะแนนเต็ม ${assignment.maxPoints} คะแนน`, `Max ${assignment.maxPoints} points`)}</span>
              </div>

              {assignment.description ? (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{assignment.description}</p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">{t("ไม่มีคำอธิบาย", "No description provided")}</p>
              )}
            </div>
          </div>

          {/* Right: Submit section */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{t("งานของฉัน", "My Work")}</h2>

              {/* Graded state */}
              {isGraded && (
                <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-xs font-semibold text-green-700 mb-1">{t("ตรวจแล้ว", "Graded")}</p>
                  <p className="text-2xl font-bold text-green-700 tabular-nums">
                    {score}<span className="text-sm font-normal text-green-600">/{assignment.maxPoints}</span>
                  </p>
                  {mySubmission?.instructorComment && (
                    <p className="text-xs text-green-700 mt-2 leading-relaxed">{mySubmission.instructorComment}</p>
                  )}
                </div>
              )}

              {/* Submitted (waiting) state */}
              {(submitted || (mySubmission && !isGraded)) && (
                <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600">{t("ส่งแล้ว รอผล", "Submitted — awaiting grade")}</p>
                      {mySubmission?.submittedAt && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(mySubmission.submittedAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* No submission yet */}
              {!mySubmission && !submitted && (
                <div className="mb-4 p-3 rounded-xl border border-dashed border-[var(--border-subtle)] text-center">
                  <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่ได้ส่งงาน", "Not submitted yet")}</p>
                </div>
              )}

              {/* Submit button (hidden if graded) */}
              {!isGraded && !isPast && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={submitting}
                  className="w-full h-10 rounded-xl bg-[#F97316] text-white text-sm font-semibold hover:bg-[#ea6c0d] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] transition-colors"
                >
                  {SUBMIT_BTN_LABEL}
                </button>
              )}
              {isPast && !mySubmission && (
                <p className="text-xs text-[var(--s-err-text)] text-center">{t("เกินกำหนดแล้ว ไม่สามารถส่งได้", "Past due — submission closed")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmOpen(false)} aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="submit-confirm-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
          >
            <div>
              <h3 id="submit-confirm-title" className="text-sm font-bold text-[var(--text-primary)]">
                {t("ยืนยันการส่งงาน?", "Confirm submission?")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(
                  `ส่ง "${assignment.name}" — เมื่อส่งแล้วอาจารย์จะเห็นงานของคุณ`,
                  `Submit "${assignment.name}" — your instructor will be able to see your work`
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] transition-colors"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-9 rounded-xl bg-[#F97316] text-white text-sm font-semibold hover:bg-[#ea6c0d] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] transition-colors"
              >
                {submitting ? t("กำลังส่ง…", "Submitting…") : t("ยืนยัน ส่งงาน", "Confirm & Submit")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
