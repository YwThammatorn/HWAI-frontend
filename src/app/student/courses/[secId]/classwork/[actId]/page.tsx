"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import RubricCriterionCard from "@/components/RubricCriterionCard";
import { useAssignments, submissionAttachments, studentVisibleSubmission, AssignmentAttachment, dueAt, isLate, submissionOpen, submissionClosesAt, CLEARED_RESULT, activeLatePolicy, describeLatePolicy, daysLate, latePenaltyFor, latePenaltyOf, finalScoreOf } from "@/lib/assignments";
import { appNow, useNow } from "@/lib/clock";
import { computeExamStats, computeAssignmentStats } from "@/lib/examStats";
import ExamStatsCard from "@/components/ExamStatsCard";
import { removeFile } from "@/lib/fileStorage";
import { useStudents } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import TeamFormationModal from "@/components/TeamFormationModal";
import { AttachmentList, SubmissionFilesPicker, normalizeLinkUrl, useAttachmentsDraft } from "@/components/AssignmentAttachments";
import AssignmentStatusBadge, { STATUS_STYLE } from "@/components/AssignmentStatusBadge";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";

import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function StudentClassworkDetailPage() {
  const { actId } = useParams<{ secId: string; actId: string }>();
  const { user } = useAuth();
  const { getSubmissionsByAssignment } = useAssignments();
  const mine = getSubmissionsByAssignment(actId).find((s) => s.studentId === (user?.studentId ?? user?.email ?? ""));
  // The form starts from what the student already submitted (files + link), so remount it
  // whenever their submission appears or changes rather than syncing draft state by hand.
  const formKey = mine ? `${mine.id}:${submissionAttachments(mine).map((a) => a.id).join(",")}` : "none";
  return <ClassworkDetail key={formKey} />;
}

function ClassworkDetail() {
  const { secId, actId } = useParams<{ secId: string; actId: string }>();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, addSubmission, updateSubmission, getRubricsByAssignment } = useAssignments();
  const { getStudentsByCourse } = useStudents();
  const { getGroupForStudent, updateGroup, removeGroup } = useStudentGroups();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const now = useNow();

  const course = getCourse(secId);
  const assignment = getAssignment(actId);
  const rubrics = getRubricsByAssignment(actId);
  const allSubs = getSubmissionsByAssignment(actId);
  const studentId = user?.studentId ?? user?.email ?? "";
  const myRawSubmission = allSubs.find((s) => s.studentId === studentId);
  // Until the teacher announces results the student sees no score — and can't overwrite a graded submission.
  const mySubmission = myRawSubmission ? studentVisibleSubmission(assignment, myRawSubmission) : undefined;
  const beingGraded = myRawSubmission?.status === "graded" && !assignment?.gradingFinalized;

  // Resubmitting starts from the previous submission: its files (each removable) and its link
  const previous = submissionAttachments(mySubmission);
  const [linkValue, setLinkValue] = useState(() => previous.find((a) => a.kind === "link")?.ref ?? "");
  const files = useAttachmentsDraft(previous.filter((a) => a.kind !== "link"));

  // An Exam is never submitted and never a team task (25/9/2569) — the student just waits for the score.
  const isExam = !!assignment?.isExam;
  const isGroup = !isExam && assignment?.submissionType === "group";
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

  // Past the deadline; students can still submit during the late window (submissionOpen) — after it the form closes and grading may start
  const due = dueAt(assignment);
  const isPast = !!due && now > due.getTime();
  const open = submissionOpen(assignment, now);
  const late = isLate(assignment, now);
  const closesAt = submissionClosesAt(assignment);
  const isGraded = mySubmission?.status === "graded";
  const locked = isGraded || beingGraded;
  const score = mySubmission ? finalScoreOf(assignment, mySubmission) : null;
  // The teacher's own mark before the late deduction, and what was taken (0 for on-time work or when late work costs nothing)
  const penalty = mySubmission ? latePenaltyOf(assignment, mySubmission) : 0;
  const latePolicy = activeLatePolicy(assignment);
  // what handing in right now would cost, shown before the student presses Submit
  const costIfNow = latePolicy && late ? latePenaltyFor(latePolicy, daysLate(assignment, now), assignment.maxPoints) : 0;
  // What each rubric criterion earned — only real per-criterion scores the teacher saved (a graded submission is
  // already masked to nothing until results are announced), never an estimate.
  const earnedByCriterion = isGraded ? mySubmission?.criterionScores : undefined;
  // Class min / average / max / SD for an announced exam (null for anything else, and until results are announced)
  const examStats = computeExamStats(assignment, allSubs);
  const examResultShown = !!examStats && isGraded;
  // An announced ordinary assignment gets the same "where do I stand" chart, below the brief (11/10/2569)
  const classStats = examStats ?? computeAssignmentStats(assignment, allSubs);
  // A link is always offered when the assignment accepts attachments at all —
  // not just for fileTypes that include "figma" — since plenty of valid
  // submissions are links regardless of tool (GitHub repo, Google Doc, etc).
  const wantsLink = assignment.acceptsFiles;
  const wantsFileUpload = assignment.acceptsFiles && assignment.fileTypes.some((ft) => ft === "pdf" || ft === "image");
  const fileAccept = assignment.fileTypes
    .filter((ft) => ft !== "figma")
    .map((ft) => (ft === "pdf" ? ".pdf" : "image/*"))
    .join(",");
  const linkUrl = normalizeLinkUrl(linkValue);
  const linkInvalid = linkValue.trim() !== "" && linkUrl === null;
  const hasAttachment = linkUrl !== null || files.items.length > 0;
  // acceptsFiles=true with an empty fileTypes list means there's nothing the
  // student could actually attach (no UI renders for it either) — treat that
  // the same as not requiring an attachment, rather than blocking submission.
  const attachmentOk = !assignment.acceptsFiles || assignment.fileTypes.length === 0 || hasAttachment;
  const canSubmit = (!isGroup || !!myGroup) && attachmentOk && !linkInvalid;

  function handleSubmit() {
    if (!submissionOpen(assignment!, appNow())) return;     // the window closed while the form was open
    setSubmitting(true);
    const lateNow = isLate(assignment!, appNow());
    const submittedAt = new Date(appNow()).toISOString();
    const attachments: AssignmentAttachment[] = [
      ...files.items,
      ...(linkUrl ? [{ id: crypto.randomUUID(), kind: "link" as const, name: linkUrl, source: "url" as const, ref: linkUrl }] : []),
    ];
    const fileUrl = linkUrl; // legacy single-link field
    const memberIds = isGroup && myGroup ? myGroup.memberStudentIds : [studentId];
    // A resubmission replaces the earlier one, so its uploads are no longer referenced
    const replacedRefs = new Set<string>();
    memberIds.forEach((id) => {
      const existing = allSubs.find((s) => s.studentId === id);
      if (existing) {
        submissionAttachments(existing).forEach((a) => { if (a.source === "upload") replacedRefs.add(a.ref); });
        // a resubmission is a new piece of work: the earlier file's result (AI marks, teacher marks, comments) does not stay on it
        updateSubmission(existing.id, { ...CLEARED_RESULT, status: "not_graded", fileUrl, attachments, submittedAt, late: lateNow });
        return;
      }
      const info = memberInfo(id);
      addSubmission({
        assignmentId: actId,
        studentId: id,
        studentName: info.name,
        email: info.email,
        submittedAt,
        late: lateNow,
        fileUrl,
        attachments,
        aiScore: null,
        instructorScore: null,
        instructorComment: "",
        externalUseConsent: false,
        status: "not_graded",
        ...(myGroup ? { groupId: myGroup.id } : {}),
      });
    });
    const keptRefs = new Set(attachments.filter((a) => a.source === "upload").map((a) => a.ref));
    replacedRefs.forEach((ref) => { if (!keptRefs.has(ref)) removeFile(ref); });
    setSubmitting(false);
    setConfirmOpen(false);
    setSubmitted(true);
    files.commit(); // the uploads now belong to the submission — don't free them on leave
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
    <div className="w-full px-8 py-8">
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
          <div className={`${examResultShown ? "lg:col-span-3" : "lg:col-span-2"} flex flex-col gap-4`}>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{assignment.name}</h1>
                <AssignmentTypeBadge type={assignment.submissionType === "group" ? "group" : "individual"} size="md" />
              </div>

              <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Icon name="calendar" size="sm" />
                  {due ? (
                    <>
                      <span className={isPast && !mySubmission ? "text-[var(--st-overdue-text)] font-semibold" : ""}>
                        {t("กำหนดส่ง:", "Due:")} {due.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      {isPast && !mySubmission && <AssignmentStatusBadge status="overdue" />}
                    </>
                  ) : (
                    <span>{t("สอบ — ไม่ต้องส่งงาน", "Exam — nothing to submit")}</span>
                  )}
                </span>
                <span className="text-[var(--text-muted)]">{t(`คะแนนเต็ม ${assignment.maxPoints} คะแนน`, `Max ${assignment.maxPoints} points`)}</span>
              </div>

              {assignment.description ? (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{assignment.description}</p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">{t("ไม่มีคำอธิบาย", "No description provided")}</p>
              )}
              <AttachmentList attachments={assignment.attachments} />
            </div>

            {/* What the student came for, first (advisor, 10/11/2569; R11, 3.3.3 step 8): the teacher's comment, then the points per criterion; the class figures come after */}
            {isGraded && !examStats && mySubmission?.instructorComment && (
              <section data-testid="teacher-comment" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-2">{t("ความเห็นจากอาจารย์", "Teacher's comment")}</h2>
                <p className="text-sm leading-relaxed text-[var(--text-primary)]">{mySubmission.instructorComment}</p>
              </section>
            )}

            {/* Rubric — read-only, shows what the student will be graded on */}
            {rubrics.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                  {earnedByCriterion ? t("เกณฑ์การให้คะแนน — คะแนนที่คุณได้", "Grading Rubric — your points") : t("เกณฑ์การให้คะแนน", "Grading Rubric")}
                </h2>
                <div className="flex flex-col gap-3">
                  {rubrics.flatMap((rubric) => rubric.criteria).map((c) => (
                    <RubricCriterionCard key={c.id} criterion={c} earned={earnedByCriterion?.[c.id]} />
                  ))}
                </div>
              </div>
            )}
            {classStats && (
              <ExamStatsCard
                name={assignment.name}
                maxPoints={assignment.maxPoints}
                stats={classStats}
                myScore={isGraded ? score : null}
                comment={examStats && isGraded ? mySubmission?.instructorComment || undefined : undefined}
                showName={false}
              />
            )}
          </div>

          {/* Right: Submit section — an exam with its score announced has nothing left to show here:
              the score and the class comparison are in the stats card, so this column goes away. */}
          {!examResultShown && (
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
                            <Avatar initials={initialsOf(info.name)} />
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
                      onClick={() => setTeamModalOpen(true)}
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
                <div className={`mb-4 p-3 rounded-xl border ${STATUS_STYLE.graded.panel}`}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                    {t("ตรวจแล้ว", "Graded")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {score}<span className="text-sm font-normal opacity-80">/{assignment.maxPoints}</span>
                  </p>
                  {penalty > 0 && score !== null && (
                    <p data-testid="late-deduction" className="text-xs mt-1 tabular-nums">
                      {t(`คะแนนงาน ${score + penalty} − ส่งช้าหัก ${penalty}`, `Work scored ${score + penalty} − late deduction ${penalty}`)}
                    </p>
                  )}
                  <AttachmentList attachments={submissionAttachments(mySubmission)} title={t("งานที่ส่ง", "Submitted work")} />
                </div>
              )}

              {/* Exam, not scored yet: no submit form at all, just waiting for the teacher */}
              {isExam && !isGraded && (
                <div className={`p-3 rounded-xl border ${STATUS_STYLE.awaiting_score.panel}`}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                    {t("รอรับคะแนนสอบ", "Waiting for your exam score")}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {t("ไม่ต้องส่งงานสำหรับการสอบนี้ — คะแนนจะแสดงที่นี่เมื่ออาจารย์บันทึกให้", "There's nothing to submit for this exam — your score will appear here once your teacher records it")}
                  </p>
                </div>
              )}

              {/* Submitted (waiting) state */}
              {!isExam && (submitted || (mySubmission && !isGraded)) && (
                <div className={`mb-4 p-3 rounded-xl border ${STATUS_STYLE.submitted.panel}`}>
                  <div className="flex items-center gap-2">
                    <Icon name="check-circle" />
                    <div>
                      <p className="text-xs font-semibold">{t("ส่งแล้ว รอผล", "Submitted — awaiting grade")}</p>
                      {mySubmission?.submittedAt && (
                        <p className="text-[10px] opacity-75 mt-0.5">
                          {new Date(mySubmission.submittedAt).toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <AttachmentList attachments={submissionAttachments(mySubmission)} title={t("งานที่ส่ง", "Submitted work")} />
                </div>
              )}

              {/* No submission yet */}
              {!isExam && !mySubmission && !submitted && (
                <div className={`mb-4 p-3 rounded-xl border border-dashed text-center ${STATUS_STYLE[isPast ? "overdue" : "not_submitted"].panel}`}>
                  <p className="text-xs font-medium">
                    {isGroup && !myGroup ? t("เข้าร่วมทีมก่อนถึงจะส่งงานได้", "Join a team before you can submit") : t("ยังไม่ได้ส่งงาน", "Not submitted yet")}
                  </p>
                </div>
              )}

              {/* Attach a file or link — only for assignments configured to accept one */}
              {!isExam && late && !locked && closesAt && (
                <p data-testid="late-note" role="status" className="mb-4 rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--s-warn-text)]">
                  {t(`เลยกำหนดแล้ว — ยังส่งช้าได้ถึง ${closesAt.toLocaleString(dateLocale(lang), { day: "numeric", month: "short" })} น. หลังจากนั้นจะปิดรับ`,
                    `Past due — you can still submit late until ${closesAt.toLocaleString(dateLocale(lang), { day: "numeric", month: "short" })}. After that submissions close.`)}
                  {latePolicy && latePolicy.mode !== "none" && (
                    <span data-testid="late-cost" className="block mt-1 font-semibold">
                      {t(`ส่งตอนนี้ (ช้า ${daysLate(assignment, now)} วัน) จะถูกหัก ${costIfNow} คะแนน — ${describeLatePolicy(latePolicy, t)}`,
                        `Submitting now (${daysLate(assignment, now)} day${daysLate(assignment, now) === 1 ? "" : "s"} late) costs ${costIfNow} point${costIfNow === 1 ? "" : "s"} — ${describeLatePolicy(latePolicy, t)}`)}
                    </span>
                  )}
                </p>
              )}
              {!isExam && !late && !locked && open && latePolicy && closesAt && (
                <p data-testid="late-policy-note" className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {t(`ส่งช้าได้ถึง ${closesAt.toLocaleString(dateLocale(lang), { day: "numeric", month: "short" })} — ${describeLatePolicy(latePolicy, t)}`,
                    `Late work accepted until ${closesAt.toLocaleString(dateLocale(lang), { day: "numeric", month: "short" })} — ${describeLatePolicy(latePolicy, t)}`)}
                </p>
              )}

              {!isExam && !locked && open && assignment.acceptsFiles && (
                <div className="mb-4 flex flex-col gap-3">
                  {mySubmission && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {t("แก้ไขงานที่ส่งแล้ว — การเปลี่ยนแปลงจะมีผลเมื่อกด “ส่งอีกครั้ง”", "You're editing your submission — changes apply when you press Resubmit")}
                    </p>
                  )}
                  {wantsLink && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t("ลิงก์", "Link")}</label>
                      <input
                        type="url"
                        value={linkValue}
                        onChange={(e) => setLinkValue(e.target.value)}
                        placeholder="เช่น ลิงก์ Figma, GitHub, Google Docs"
                        aria-invalid={linkInvalid}
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                      />
                      {linkInvalid && (
                        <p role="alert" className="text-xs text-[var(--s-err-text)]">
                          {t("ลิงก์ไม่ถูกต้อง เช่น https://github.com/...", "That doesn't look like a link, e.g. https://github.com/...")}
                        </p>
                      )}
                    </div>
                  )}
                  {wantsFileUpload && (
                    <SubmissionFilesPicker
                      items={files.items}
                      onChange={files.setItems}
                      accept={fileAccept}
                      label={`${t("แนบไฟล์", "Attach files")} (${assignment.fileTypes.filter((ft) => ft !== "figma").map((ft) => (ft === "pdf" ? "PDF" : t("รูปภาพ", "Image"))).join(", ")})`}
                    />
                  )}
                </div>
              )}

              {/* Submit button (hidden if graded) */}
              {!isExam && !locked && open && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={submitting || !canSubmit}
                  title={
                    isGroup && !myGroup
                      ? t("เข้าร่วมทีมก่อนถึงจะส่งงานได้", "Join a team before you can submit")
                      : !attachmentOk
                      ? t("แนบไฟล์หรือใส่ลิงก์ก่อนส่งงาน", "Attach a file or link before submitting")
                      : linkInvalid
                      ? t("ลิงก์ไม่ถูกต้อง", "Fix the link before submitting")
                      : undefined
                  }
                  className="w-full h-10 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                >
                  {SUBMIT_BTN_LABEL}
                </button>
              )}
              {!isExam && !open && !mySubmission && (
                <p data-testid="submission-closed" className="text-xs text-[var(--st-overdue-text)] text-center">{latePolicy ? t("ปิดรับส่งงานแล้ว — พ้นวันปิดรับแล้ว", "Submission closed — the closing date has passed") : t("ปิดรับส่งงานแล้ว — เลยกำหนดส่งแล้ว", "Submission closed — the due date has passed")}</p>
              )}
            </div>
          </div>
          )}
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

      {teamModalOpen && (
        <TeamFormationModal
          courseId={secId}
          assignmentId={actId}
          maxGroupSize={assignment.maxGroupSize}
          currentStudentId={studentId}
          onCreated={() => setTeamModalOpen(false)}
          onClose={() => setTeamModalOpen(false)}
        />
      )}
    </>
  );
}
