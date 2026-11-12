"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn, withdrawnIds } from "@/lib/students";
import { useAssignments, isManualGrading, isAiOnlyGraded, gradingOpen, gradingOpensAt, finalScoreOf, type Assignment, type Submission } from "@/lib/assignments";
import { appNow, useNow } from "@/lib/clock";
import { gradingStageOf } from "@/lib/gradingStage";
import GradingStageChip from "@/components/GradingStageChip";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useAiGrading } from "@/lib/useAiGrading";
import { useCan } from "@/lib/useCan";
import { useGradableAssignments } from "@/lib/useGradableAssignments";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import SearchInput from "@/components/SearchInput";
import PillTabBar, { type PillTabTone } from "@/components/PillTabBar";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import AssignmentGradingCard from "@/components/AssignmentGradingCard";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";
import Modal from "@/components/Modal";
import AiGradePreviewModal from "@/components/AiGradePreviewModal";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
type QueueFilter = "all" | "review" | "notgraded" | "done" | "waiting";

function fmtDate(dateStr: string, lang: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(dateLocale(lang), {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** "16 Oct, 01:00" — when grading opens for this assignment. */
function opensText(a: Assignment, lang: string) {
  const d = gradingOpensAt(a);
  return d ? d.toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
}

/** What still needs doing on one assignment — the numbers every row and stat card is built from. */
function progressOf(a: Assignment, subs: Submission[], today: string, enrolled: number, now: number) {
  const graded = subs.filter((s) => s.status === "graded");
  const needReview = subs.filter((s) => s.status === "need_review").length;
  const notGraded = subs.filter((s) => s.status === "not_graded").length;
  // An Exam is never submitted (25/9/2569): it is complete once EVERY enrolled student has a score,
  // and it can't be overdue because it has no due date.
  const complete = a.isExam
    ? enrolled > 0 && graded.length >= enrolled
    : subs.length > 0 && graded.length === subs.length;
  const overdue = !!a.dueDate && a.dueDate < today && subs.some((s) => s.status !== "graded");
  const scored = graded.map((s) => finalScoreOf(a, s) ?? 0);
  const avgPct = scored.length > 0 && a.maxPoints > 0
    ? Math.round((scored.reduce((sum, v) => sum + v, 0) / scored.length / a.maxPoints) * 100)
    : null;
  // Sort weight: needs review first, then overdue, then anything still open, then waiting on students, then done.
  const rank = needReview > 0 ? 0 : overdue ? 1 : notGraded > 0 ? 2 : subs.length === 0 ? 3 : complete ? 4 : 2;
  return { gradedCount: graded.length, needReview, notGraded, complete, overdue, avgPct, rank, stage: gradingStageOf(a, subs, enrolled, now) };
}

export default function CourseGradingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getSubmissionsByAssignment, updateAssignment, updateSubmission } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();
  const { waitingUnits, sendWaiting } = useAiGrading();
  const can = useCan();
  // Grading opens only once the due date and the students' late window have passed (15/10/2569) — see gradingOpen in lib/assignments.ts
  const now = useNow();

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  // switching an assignment to Manual that the AI already scored asks first
  const [manualFor, setManualFor] = useState<Assignment | null>(null);
  // "Grade with AI" shows what is about to be sent (and with which rubric) before anything is written (22/10/2569)
  const [previewFor, setPreviewFor] = useState<Assignment | null>(null);
  // the assignment whose work is being sent to the AI right now
  const [sendingId, setSendingId] = useState<string | null>(null);

  const course = getCourse(id);
  const roster = getStudentsByCourse(id);
  // Withdrawn students are out of every class-level number here (24/9/2569) — see lib/students.ts withdrawnIds.
  const students = roster.filter((s) => !isWithdrawn(s));
  const withdrawn = withdrawnIds(roster);
  const assignments = useGradableAssignments(id);     // a TA lists only the work a teacher gave them (10/11/2569)
  const categories = getCategoriesByCourse(id);
  const today = new Date().toISOString().split("T")[0];

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
        <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
      </main>
    );
  }

  const items = assignments.map((a) => {
    const subs = getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId));
    return { a, subs, p: progressOf(a, subs, today, students.length, now) };
  });

  // Stat cards — three only (11/10/2569): how many assignments there are, how many are fully graded, how many announced.
  // Per-assignment detail (needs review, overdue …) lives in the queue below and its filters.
  const totalAssignments = items.length;
  const gradedAssignments = items.filter((i) => i.p.complete).length;
  const announcedAssignments = items.filter((i) => i.a.gradingFinalized).length;

  // Grading method (11/10/2569): the button that starts grading IS the choice, and it is the TEACHER who starts it.
  //   "Grade with AI"   → every submission of that assignment still waiting is sent to the AI; each comes back scored (or
  //                       "needs review"), and the teacher opens the assignment to review them. Nothing is graded before this.
  //   "Grade manually"  → the AI is not used: the teacher opens the assignment and scores each submission by hand. Work that only
  //                       the AI scored goes back to "not graded" (the teacher's own scores stay), so that asks first.
  const aiOnlyOf = (a: Assignment) => getSubmissionsByAssignment(a.id).filter(isAiOnlyGraded);
  // the other half, shown in the same dialog so the "Graded" count on the assignment page afterwards is no surprise
  const handScoredOf = (a: Assignment) => getSubmissionsByAssignment(a.id).filter((s) => s.status !== "not_graded" && s.instructorScore !== null);
  const gradingHref = (a: Assignment) => `/teacher/courses/${id}/assignments/${a.id}/grading`;
  async function applyAndGo(a: Assignment, mode: "ai" | "manual") {
    setManualFor(null);
    if (mode !== (isManualGrading(a) ? "manual" : "ai")) {
      if (mode === "manual") {
        aiOnlyOf(a).forEach((sub) => updateSubmission(sub.id, { aiScore: null, aiCriterionScores: undefined, aiEvidence: undefined, instructorScore: null, status: "not_graded", criterionScores: undefined, criterionComments: undefined }));
      }
      updateAssignment(a.id, { gradingMode: mode });
    }
    if (mode === "ai") {
      setSendingId(a.id);
      await sendWaiting(a);
      setSendingId(null);
    }
    router.push(gradingHref(a));
  }
  function startGrading(a: Assignment, mode: "ai" | "manual") {
    if (sendingId || !gradingOpen(a, appNow())) return;
    if (mode === "manual" && !isManualGrading(a) && aiOnlyOf(a).length > 0) { setManualFor(a); return; }
    if (mode === "ai") { setPreviewFor(a); return; }     // look at the rubric first — also when nothing is waiting any more (continuing)
    void applyAndGo(a, mode);
  }

  const matchesFilter = (i: (typeof items)[number]) => {
    switch (filter) {
      case "review": return i.p.needReview > 0;
      case "notgraded": return i.p.notGraded > 0;
      case "done": return i.p.complete;
      case "waiting": return i.subs.length === 0;
      default: return true;
    }
  };
  const q = search.trim().toLowerCase();
  const visible = items
    .filter(matchesFilter)
    .filter((i) => !q || i.a.name.toLowerCase().includes(q))
    .sort((x, y) => x.p.rank - y.p.rank || (x.a.dueDate ?? "9999-12-31").localeCompare(y.a.dueDate ?? "9999-12-31"));

  const tabs: { key: QueueFilter; label: string; count: number; tone: PillTabTone }[] = [
    { key: "all", label: t("ทั้งหมด", "All"), count: items.length, tone: "info" },
    { key: "review", label: t("รอตรวจสอบ", "Needs review"), count: items.filter((i) => i.p.needReview > 0).length, tone: "warn" },
    { key: "notgraded", label: t("ยังไม่ตรวจ", "Not graded"), count: items.filter((i) => i.p.notGraded > 0).length, tone: "neutral" },
    { key: "done", label: t("ตรวจครบแล้ว", "Completed"), count: items.filter((i) => i.p.complete).length, tone: "ok" },
    { key: "waiting", label: t("รอนักศึกษาส่ง", "Awaiting submissions"), count: items.filter((i) => i.subs.length === 0).length, tone: "neutral" },
  ];

  const statCards = [
    {
      label: t("งานทั้งหมด", "Total Assignments"), value: totalAssignments,
      tone: "info" as const, icon: "file-text" as const,
    },
    {
      label: t("ให้คะแนนแล้ว", "Graded"), value: gradedAssignments,
      tone: "ok" as const, icon: "check-circle" as const,
    },
    {
      label: t("ประกาศแล้ว", "Announced"), value: announcedAssignments,
      tone: "accent" as const, icon: "megaphone" as const,
    },
  ];

  return (
    <main className="w-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("ตรวจงาน", "Grading")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ตรวจงาน", "Grading")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {course.name} · {students.length} {t("นักศึกษา", "students")}
          </p>
        </div>
        <Link
          href={`/teacher/courses/${id}/results`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] transition-colors shrink-0"
        >
          {t("ไปที่สมุดคะแนน", "Open Score Book")}
          <Icon name="arrow-right" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} icon={s.icon} />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="check-square"
          title={can.isTa ? t("ยังไม่ได้รับมอบหมายงาน", "No work assigned to you yet") : t("ยังไม่มีงานให้ตรวจ", "Nothing to grade yet")}
          description={can.isTa ? t("งานที่อาจารย์มอบหมายให้คุณตรวจจะขึ้นที่นี่", "The work your teacher gives you to grade will appear here") : t("สร้างงานก่อน แล้วงานที่นักศึกษาส่งจะมาอยู่ที่นี่", "Create an assignment first — student submissions will queue up here")}
          action={can.isTa ? undefined :
            <Link
              href={`/teacher/courses/${id}/assignments/new`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
            >
              {t("สร้างชิ้นงาน", "Create Assignment")}
            </Link>
          }
        />
      ) : (
        <>
          {/* Filter + search */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <PillTabBar variant="boxed" minBoxWidth="14.5rem" tabs={tabs} activeKey={filter} onChange={(k) => setFilter(k as QueueFilter)} ariaLabel={t("กรองงานที่ต้องตรวจ", "Filter the grading queue")} />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ค้นหาชิ้นงาน...", "Search assignments...")}
              ariaLabel={t("ค้นหาชิ้นงาน", "Search assignments")}
              suggestions={items.map((i) => i.a.name)}
              className="w-56 shrink-0"
            />
          </div>

          {/* Queue — one stat card per assignment */}
          <div>
            {visible.length === 0 ? (
              <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-14 text-center text-sm text-[var(--text-muted)]">
                {q ? t(`ไม่พบชิ้นงานที่ตรงกับ "${search}"`, `No assignments match "${search}"`) : t("ไม่มีชิ้นงานในหมวดนี้", "No assignments in this view")}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {visible.map(({ a, subs, p }) => {
                  const category = a.categoryId ? categories.find((c) => c.id === a.categoryId) : undefined;
                  const total = subs.length;
                  return (
                    <AssignmentGradingCard
                      key={a.id}
                      name={a.name}
                      total={subs.length}
                      enrolled={students.length}
                      isExam={!!a.isExam}
                      graded={p.gradedCount}
                      needReview={p.needReview}
                      notGraded={p.notGraded}
                      avgPct={p.avgPct}
                      meta={
                        <>
                          <span>{a.dueDate ? <>{t("กำหนดส่ง", "Due")} {fmtDate(a.dueDate, lang)}</> : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}</span>
                          <GradingStageChip stage={p.stage} />
                          <AssignmentTypeBadge type={a.submissionType} />
                          {category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium tabular-nums">
                            {category.name} ({category.weight}%)
                          </span>
                          )}

                        </>
                      }
                      actions={
                        <>
                          {p.complete ? (
                            <>
                              <Link
                                href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                                className="px-3 h-9 inline-flex items-center whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-[.97] transition-colors"
                              >
                                {t("ทบทวน", "Review")}
                              </Link>
                              <Link
                                href={`/teacher/courses/${id}/assignments/${a.id}/results`}
                                className="px-3 h-9 inline-flex items-center whitespace-nowrap rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                              >
                                {t("ดูผลลัพธ์", "View Results")}
                              </Link>
                            </>
                          ) : total === 0 ? (
                            <span className="text-xs text-[var(--text-muted)]">{t("รอนักศึกษาส่งงาน", "Awaiting submissions")}</span>
                          ) : !gradingOpen(a, now) ? (
                            // the due date or the late hour has not passed yet: nothing can be graded while the work can still change
                            <div data-testid="grading-locked" className="flex flex-col items-end gap-0.5 text-right">
                              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)]">
                                <Icon name="lock" size="xs" />
                                {t("ยังตรวจไม่ได้", "Not open for grading yet")}
                              </span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {t(`เปิดตรวจได้ ${opensText(a, lang)} น.`, `Opens ${opensText(a, lang)}`)}
                              </span>
                            </div>
                          ) : can.isTa ? (
                            // a TA gives and changes scores; the AI and the grading method are the teacher's (10/11/2569)
                            <Link
                              href={gradingHref(a)}
                              data-testid="ta-grade"
                              className="px-3 h-9 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                            >
                              <Icon name="play" />
                              {t("ตรวจงาน", "Grade")}
                            </Link>
                          ) : a.isExam || a.acceptsFiles === false || a.gradingFinalized ? (
                            // nothing to choose: an exam is typed in, no files means nothing for the AI, announced work keeps its method
                            <div className="flex flex-col items-end gap-1">
                              <Link
                                href={gradingHref(a)}
                                className="px-3 h-9 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                              >
                                <Icon name="play" />
                                {t("เริ่มตรวจงาน", "Start Grading")}
                              </Link>
                              {!a.isExam && (
                                <span data-testid="grading-mode-locked" className="text-xs text-[var(--text-muted)]">
                                  {a.acceptsFiles === false ? t("ตรวจเองเท่านั้น — ไม่รับไฟล์", "Manual only — takes no files") : t("ล็อกวิธีตรวจ — ประกาศผลแล้ว", "Method locked — results announced")}
                                </span>
                              )}
                            </div>
                          ) : (
                            // the choice: the method already in use is the filled button, the other one is outlined
                            <div role="group" aria-label={t(`เลือกวิธีตรวจ — ${a.name}`, `Choose how to grade — ${a.name}`)} className="flex w-full flex-wrap gap-2">
                              {(["ai", "manual"] as const).map((m) => {
                                const current = (isManualGrading(a) ? "manual" : "ai") === m;
                                const waiting = m === "ai" ? waitingUnits(a).length : 0;
                                const busy = sendingId === a.id && m === "ai";
                                return (
                                  <button
                                    key={m}
                                    type="button"
                                    disabled={!!sendingId}
                                    onClick={() => startGrading(a, m)}
                                    title={m === "ai"
                                      ? (waiting > 0
                                        ? t(`ส่งงานที่ยังไม่ตรวจ ${waiting} ชิ้นให้ AI ตรวจ แล้วเปิดให้คุณตรวจทาน`, `Sends the ${waiting} not-graded ${waiting === 1 ? "submission" : "submissions"} to the AI, then opens them for your review`)
                                        : t("ไม่มีงานที่รอ AI — ดู rubric แล้วเปิดหน้าตรวจต่อ", "Nothing is waiting for the AI — shows the rubric, then opens the grading page"))
                                      : t("ไม่ใช้ AI — คุณให้คะแนนเองทีละงาน", "No AI — you score each submission yourself")}
                                    className={`flex-1 min-w-[9rem] whitespace-nowrap px-3 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold active:scale-[.97] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] disabled:cursor-wait disabled:opacity-70 ${current
                                      ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)]"
                                      : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"}`}
                                  >
                                    {busy && (
                                      <Icon name="spinner" className="animate-spin" />
                                    )}
                                    {busy
                                      ? t(`AI กำลังตรวจ ${waiting} ชิ้น…`, `AI grading ${waiting}…`)
                                      : m === "ai"
                                        ? (waiting > 0
                                          ? (a.rubricRestartedAt ? t(`ตรวจใหม่ด้วย rubric ใหม่ (${waiting})`, `Regrade with new rubric (${waiting})`) : t(`ตรวจด้วย AI (${waiting})`, `Grade with AI (${waiting})`))
                                          : t("ตรวจด้วย AI", "Grade with AI"))
                                        : t("ตรวจเอง", "Grade manually")}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]" aria-live="polite">
            {t(`แสดง ${visible.length} จาก ${items.length} ชิ้นงาน`, `Showing ${visible.length} of ${items.length} assignments`)}
          </p>
        </>
      )}

      {previewFor && (
        <AiGradePreviewModal
          assignment={previewFor}
          open
          onClose={() => setPreviewFor(null)}
          onConfirm={() => { const a = previewFor; setPreviewFor(null); void applyAndGo(a, "ai"); }}
        />
      )}

      <Modal
        open={!!manualFor}
        onClose={() => setManualFor(null)}
        size="sm"
        title={t("เปลี่ยนเป็นตรวจเอง?", "Switch to manual grading?")}
        description={manualFor?.name}
        footer={
          <>
            <button
              type="button"
              onClick={() => setManualFor(null)}
              className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              {t("ยังก่อน", "Not yet")}
            </button>
            <button
              type="button"
              onClick={() => manualFor && applyAndGo(manualFor, "manual")}
              className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              {t("เปลี่ยนแล้วเริ่มตรวจ", "Switch and grade")}
            </button>
          </>
        }
      >
        {manualFor && (
          <>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {t(
                `งานที่ AI ตรวจไว้ ${aiOnlyOf(manualFor).length} ชิ้นจะกลับเป็น “ยังไม่ตรวจ” — คุณต้องให้คะแนนเอง`,
                `${aiOnlyOf(manualFor).length} submission${aiOnlyOf(manualFor).length === 1 ? "" : "s"} scored only by the AI will go back to “Not graded” — you score them yourself.`
              )}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--text-secondary)] list-disc pl-5">
              <li>
                {handScoredOf(manualFor).length > 0
                  ? t(`คะแนนที่คุณให้เองแล้ว ${handScoredOf(manualFor).length} ชิ้นยังอยู่ครบ — ไม่ถูกล้าง`, `Scores you set yourself stay — ${handScoredOf(manualFor).length} submission${handScoredOf(manualFor).length === 1 ? "" : "s"} kept as they are.`)
                  : t("คะแนนที่คุณให้เองยังอยู่ครบ", "Scores you set yourself stay.")}
              </li>
              <li>{t("คะแนน AI และปุ่ม Re-grade จะถูกซ่อน", "AI scores and the Re-grade button are hidden.")}</li>
              <li>{t("เปลี่ยนกลับเป็น “ให้ AI ช่วยตรวจ” ได้ แต่ผลที่ถูกล้างจะไม่กลับมา", "You can switch back to AI-assisted, but the cleared AI results do not come back.")}</li>
            </ul>
          </>
        )}
      </Modal>
    </main>
  );
}
