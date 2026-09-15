"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useStudents } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import TeamFormationDrawer from "@/components/TeamFormationDrawer";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function StudentClassworkDetailPage() {
  const { secId, actId } = useParams<{ secId: string; actId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, addSubmission, updateSubmission, getRubricsByAssignment } = useAssignments();
  const { getStudentsByCourse } = useStudents();
  const { getGroupForStudent, updateGroup, removeGroup } = useStudentGroups();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);

  const course = getCourse(secId);
  const assignment = getAssignment(actId);
  const rubrics = getRubricsByAssignment(actId);
  const allSubs = getSubmissionsByAssignment(actId);
  const studentId = user?.studentId ?? user?.email ?? "";
  const mySubmission = allSubs.find((s) => s.studentId === studentId);

  const isGroup = assignment?.submissionType === "group";
  const myGroup = isGroup ? getGroupForStudent(actId, studentId) : undefined;
  const roster = getStudentsByCourse(secId);

  function memberInfo(id: string) {
    if (id === studentId) return { name: user?.name ?? "Unknown Student", email: user?.email ?? "" };
    const s = roster.find((r) => r.studentId === id);
    return s ? { name: `${s.firstName} ${s.lastName}`, email: s.email } : { name: id, email: "" };
  }

  if (!course || !assignment) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t("ไม่พบข้อมูล", "Not found")}</div>
    );
  }

  const due = new Date(assignment.dueDate + "T23:59:59");
  const isPast = new Date() > due;
  const isGraded = mySubmission?.status === "graded";
  const score = mySubmission?.instructorScore ?? mySubmission?.aiScore ?? null;
  const canSubmit = !isGroup || !!myGroup;

  function handleSubmit() {
    setSubmitting(true);
    const memberIds = isGroup && myGroup ? myGroup.memberStudentIds : [studentId];
    memberIds.forEach((id) => {
      const existing = allSubs.find((s) => s.studentId === id);
      if (existing) {
        updateSubmission(existing.id, { status: "not_graded" });
        return;
      }
      const info = memberInfo(id);
      addSubmission({
        assignmentId: actId,
        studentId: id,
        studentName: info.name,
        email: info.email,
        submittedAt: new Date().toISOString(),
        fileUrl: null,
        aiScore: null,
        instructorScore: null,
        instructorComment: "",
        externalUseConsent: false,
        status: "not_graded",
        ...(myGroup ? { groupId: myGroup.id } : {}),
      });
    });
    setSubmitting(false);
    setConfirmOpen(false);
    setSubmitted(true);
  }

  function handleLeaveTeam() {
    if (!myGroup) return;
    if (!window.confirm(t(`ออกจากทีม "${myGroup.name}"?`, `Leave team "${myGroup.name}"?`))) return;
    const remaining = myGroup.memberStudentIds.filter((id) => id !== studentId);
    if (remaining.length === 0) removeGroup(myGroup.id);
    else updateGroup(myGroup.id, { memberStudentIds: remaining });
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
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-50 text-gray-500"
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

            {/* Rubric — read-only, shows what the student will be graded on */}
            {rubrics.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">{t("เกณฑ์การให้คะแนน", "Grading Rubric")}</h2>
                <div className="flex flex-col gap-3">
                  {rubrics.flatMap((rubric) => rubric.criteria).map((c) => (
                    <div key={c.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                        <span className="shrink-0 text-xs font-semibold text-[var(--accent)] tabular-nums">
                          {c.weight}% · {c.maxPoints} {t("คะแนน", "pts")}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-[var(--text-muted)] mb-2">{c.description}</p>
                      )}
                      {c.levels.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          {c.levels.map((lvl, i) => (
                            <div key={i} className="rounded-lg bg-[var(--bg-app)] p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{lvl.label}</p>
                              {lvl.description && (
                                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{lvl.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Submit section */}
          <div className="flex flex-col gap-4">
            {/* Team panel — only for group assignments */}
            {isGroup && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">{t("ทีมของฉัน", "Your team")}</h2>
                {myGroup ? (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{myGroup.name}</p>
                      <button
                        onClick={handleLeaveTeam}
                        disabled={isGraded}
                        title={isGraded ? t("ตรวจแล้ว — ออกจากทีมไม่ได้", "Already graded — can't leave the team") : t("ออกจากทีม", "Leave team")}
                        className="text-xs font-medium text-[var(--s-err-text)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed shrink-0"
                      >
                        {t("ออกจากทีม", "Leave team")}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {myGroup.memberStudentIds.map((id) => {
                        const info = memberInfo(id);
                        return (
                          <div key={id} className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)] text-[11px] font-bold shrink-0">
                              {initialsOf(info.name)}
                            </div>
                            <p className="text-xs text-[var(--text-primary)] truncate">
                              {info.name}{id === studentId && <span className="text-[var(--text-muted)]"> ({t("คุณ", "you")})</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {assignment.maxGroupSize && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-3">
                        {t(
                          `เต็มที่ ${myGroup.memberStudentIds.length}/${assignment.maxGroupSize} คน`,
                          `${myGroup.memberStudentIds.length} of ${assignment.maxGroupSize} spots filled`
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      {t("ยังไม่ได้เข้าร่วมทีม — เพื่อนร่วมทีมต้องเรียนอยู่ใน sec นี้เท่านั้น", "You haven't joined a team yet. Teammates must be classmates in this section.")}
                    </p>
                    <button
                      onClick={() => setTeamDrawerOpen(true)}
                      className="w-full h-9 rounded-xl border border-[var(--accent-bright)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      {t("จับกลุ่ม", "Form a team")}
                    </button>
                  </>
                )}
              </div>
            )}

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
                  <p className="text-xs text-[var(--text-muted)]">
                    {canSubmit ? t("ยังไม่ได้ส่งงาน", "Not submitted yet") : t("เข้าร่วมทีมก่อนถึงจะส่งงานได้", "Join a team before you can submit")}
                  </p>
                </div>
              )}

              {/* Submit button (hidden if graded) */}
              {!isGraded && !isPast && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={submitting || !canSubmit}
                  title={canSubmit ? undefined : t("เข้าร่วมทีมก่อนถึงจะส่งงานได้", "Join a team before you can submit")}
                  className="w-full h-10 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
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
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-9 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {submitting ? t("กำลังส่ง…", "Submitting…") : t("ยืนยัน ส่งงาน", "Confirm & Submit")}
              </button>
            </div>
          </div>
        </>
      )}

      {teamDrawerOpen && (
        <TeamFormationDrawer
          courseId={secId}
          assignmentId={actId}
          maxGroupSize={assignment.maxGroupSize}
          currentStudentId={studentId}
          onCreated={() => setTeamDrawerOpen(false)}
          onClose={() => setTeamDrawerOpen(false)}
        />
      )}
    </>
  );
}
