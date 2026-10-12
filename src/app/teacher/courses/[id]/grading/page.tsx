"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn, withdrawnIds } from "@/lib/students";
import { useAssignments, isManualGrading, isAiOnlyGraded, type Assignment, type Submission } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useStudentGroups } from "@/lib/studentGroups";
import { groupSubmissionsByTeam } from "@/lib/groupSubmissions";
import { mockAiGrade, mockAiGradeCriteria, waitingForAi } from "@/lib/aiGrading";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import SearchInput from "@/components/SearchInput";
import PillTabBar, { type PillTabTone } from "@/components/PillTabBar";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";
import Modal from "@/components/Modal";

type QueueFilter = "all" | "review" | "notgraded" | "done" | "waiting";

function fmtDate(dateStr: string, lang: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(dateLocale(lang), {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** What still needs doing on one assignment — the numbers every row and stat card is built from. */
function progressOf(a: Assignment, subs: Submission[], today: string, enrolled: number) {
  const graded = subs.filter((s) => s.status === "graded");
  const needReview = subs.filter((s) => s.status === "need_review").length;
  const notGraded = subs.filter((s) => s.status === "not_graded").length;
  // An Exam is never submitted (25/9/2569): it is complete once EVERY enrolled student has a score,
  // and it can't be overdue because it has no due date.
  const complete = a.isExam
    ? enrolled > 0 && graded.length >= enrolled
    : subs.length > 0 && graded.length === subs.length;
  const overdue = !!a.dueDate && a.dueDate < today && subs.some((s) => s.status !== "graded");
  const scored = graded.map((s) => (s.instructorScore ?? s.aiScore ?? 0));
  const avgPct = scored.length > 0 && a.maxPoints > 0
    ? Math.round((scored.reduce((sum, v) => sum + v, 0) / scored.length / a.maxPoints) * 100)
    : null;
  // Sort weight: needs review first, then overdue, then anything still open, then waiting on students, then done.
  const rank = needReview > 0 ? 0 : overdue ? 1 : notGraded > 0 ? 2 : subs.length === 0 ? 3 : complete ? 4 : 2;
  return { gradedCount: graded.length, needReview, notGraded, complete, overdue, avgPct, rank };
}

export default function CourseGradingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment, getRubricsByAssignment, updateAssignment, updateSubmission } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();
  const { getGroupsByAssignment } = useStudentGroups();

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  // switching an assignment to Manual that the AI already scored asks first
  const [manualFor, setManualFor] = useState<Assignment | null>(null);
  // the assignment whose work is being sent to the AI right now
  const [sendingId, setSendingId] = useState<string | null>(null);

  const course = getCourse(id);
  const roster = getStudentsByCourse(id);
  // Withdrawn students are out of every class-level number here (24/9/2569) — see lib/students.ts withdrawnIds.
  const students = roster.filter((s) => !isWithdrawn(s));
  const withdrawn = withdrawnIds(roster);
  const assignments = getAssignmentsByCourse(id);
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
    return { a, subs, p: progressOf(a, subs, today, students.length) };
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
  // one unit of work per submission, or per team for a group assignment (every member shares the team's score)
  const waitingUnits = (a: Assignment) => {
    const subs = getSubmissionsByAssignment(a.id).filter((x) => !withdrawn.has(x.studentId));
    const units = a.submissionType === "group" ? groupSubmissionsByTeam(subs, getGroupsByAssignment(a.id), "Team") : subs.map((x) => ({ key: x.id, subs: [x] }));
    return units.filter((u) => u.subs.some(waitingForAi));
  };
  const gradingHref = (a: Assignment) => `/teacher/courses/${id}/assignments/${a.id}/grading`;
  async function applyAndGo(a: Assignment, mode: "ai" | "manual") {
    setManualFor(null);
    if (mode !== (isManualGrading(a) ? "manual" : "ai")) {
      if (mode === "manual") {
        aiOnlyOf(a).forEach((sub) => updateSubmission(sub.id, { aiScore: null, aiCriterionScores: undefined, instructorScore: null, status: "not_graded", criterionScores: undefined, criterionComments: undefined }));
      }
      updateAssignment(a.id, { gradingMode: mode });
    }
    if (mode === "ai") {
      const units = waitingUnits(a);
      if (units.length > 0) {
        setSendingId(a.id);
        await new Promise((r) => setTimeout(r, 1200));       // the AI "working" (simulated)
        // with a rubric the AI scores every criterion (through the correction Calibration saved, if any); without one, a total only
        const rubric = getRubricsByAssignment(a.id)[0];
        units.forEach((u) => {
          const res = rubric && rubric.criteria.length > 0 ? mockAiGradeCriteria(u.key, rubric.criteria, rubric.aiOffsets) : { ...mockAiGrade(u.key, a.maxPoints), criterionScores: undefined };
          u.subs.filter(waitingForAi).forEach((sub) => updateSubmission(sub.id, { aiScore: res.score, aiCriterionScores: res.criterionScores, instructorScore: null, status: res.status, criterionScores: undefined, criterionComments: undefined }));
        });
        setSendingId(null);
      }
    }
    router.push(gradingHref(a));
  }
  function startGrading(a: Assignment, mode: "ai" | "manual") {
    if (sendingId) return;
    if (mode === "manual" && !isManualGrading(a) && aiOnlyOf(a).length > 0) { setManualFor(a); return; }
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
      color: "var(--s-info-text)", bg: "var(--s-info-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
        </svg>
      ),
    },
    {
      label: t("ให้คะแนนแล้ว", "Graded"), value: gradedAssignments,
      color: "var(--s-ok-text)", bg: "var(--s-ok-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
        </svg>
      ),
    },
    {
      label: t("ประกาศแล้ว", "Announced"), value: announcedAssignments,
      color: "var(--accent)", bg: "var(--accent-subtle)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>
        </svg>
      ),
    },
  ];

  return (
    <main className="w-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors" aria-label={t("รายวิชาทั้งหมด", "All courses")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} bg={s.bg} icon={s.icon} />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          }
          title={t("ยังไม่มีงานให้ตรวจ", "Nothing to grade yet")}
          description={t("สร้างงานก่อน แล้วงานที่นักศึกษาส่งจะมาอยู่ที่นี่", "Create an assignment first — student submissions will queue up here")}
          action={
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

          {/* Queue */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {visible.length === 0 ? (
              <p className="py-14 text-center text-sm text-[var(--text-muted)]">
                {q ? t(`ไม่พบชิ้นงานที่ตรงกับ "${search}"`, `No assignments match "${search}"`) : t("ไม่มีชิ้นงานในหมวดนี้", "No assignments in this view")}
              </p>
            ) : (
              <ul>
                {visible.map(({ a, subs, p }) => {
                  const category = a.categoryId ? categories.find((c) => c.id === a.categoryId) : undefined;
                  const total = subs.length;
                  const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
                  return (
                    <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_13.5rem] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_13.5rem] items-center gap-x-8 gap-y-2 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-subtle)] transition-colors">
                      {/* What it is */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                          className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline truncate block"
                        >
                          {a.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-[var(--text-secondary)]">
                          <span>{a.dueDate ? <>{t("กำหนดส่ง", "Due")} {fmtDate(a.dueDate, lang)}</> : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}</span>
                          {p.overdue && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--s-err-bg)] text-[var(--s-err-text)] font-semibold">
                              {t("เลยกำหนด", "Overdue")}
                            </span>
                          )}
                          <AssignmentTypeBadge type={a.submissionType} />
                          {category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium tabular-nums">
                              {category.name} ({category.weight}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="hidden md:block min-w-0">
                        <div className="flex items-baseline justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                          <span className="tabular-nums">
                            <span className="font-semibold text-[var(--text-primary)]">{total}</span> / {students.length} {a.isExam ? t("ให้คะแนนแล้ว", "scored") : t("ส่งแล้ว", "submitted")}
                          </span>
                          {p.avgPct !== null && (
                            <span className="tabular-nums">{t("เฉลี่ย", "Avg")} <span className="font-semibold text-[var(--text-primary)]">{p.avgPct}%</span></span>
                          )}
                        </div>
                        <div
                          className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-subtle)]"
                          role="img"
                          aria-label={t(
                            `ตรวจแล้ว ${p.gradedCount}, รอตรวจสอบ ${p.needReview}, ยังไม่ตรวจ ${p.notGraded}`,
                            `${p.gradedCount} graded, ${p.needReview} need review, ${p.notGraded} not graded`,
                          )}
                        >
                          <span className="bg-[var(--s-ok-text)]" style={{ width: seg(p.gradedCount) }} />
                          <span className="bg-[var(--s-warn-text)]" style={{ width: seg(p.needReview) }} />
                          <span className="bg-[var(--text-muted)]/40" style={{ width: seg(p.notGraded) }} />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
                          {total === 0
                            ? t("ยังไม่มีการส่งงาน", "No submissions yet")
                            : <>
                <span className="whitespace-nowrap">{t("ตรวจแล้ว", "Graded")} {p.gradedCount}</span>{" · "}
                <span className="whitespace-nowrap">{t("รอตรวจสอบ", "Needs review")} {p.needReview}</span>{" · "}
                <span className="whitespace-nowrap">{t("ยังไม่ตรวจ", "Not graded")} {p.notGraded}</span>
              </>}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 justify-end">
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
                        ) : a.isExam || a.acceptsFiles === false || a.gradingFinalized ? (
                          // nothing to choose: an exam is typed in, no files means nothing for the AI, announced work keeps its method
                          <div className="flex flex-col items-end gap-1">
                            <Link
                              href={gradingHref(a)}
                              className="px-3 h-9 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
                          <div role="group" aria-label={t(`เลือกวิธีตรวจ — ${a.name}`, `Choose how to grade — ${a.name}`)} className="flex flex-col gap-1.5 w-full">
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
                                      : t("ไม่มีงานที่รอ AI — เปิดหน้าตรวจ", "Nothing is waiting for the AI — opens the grading page"))
                                    : t("ไม่ใช้ AI — คุณให้คะแนนเองทีละงาน", "No AI — you score each submission yourself")}
                                  className={`px-3 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold active:scale-[.97] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] disabled:cursor-wait disabled:opacity-70 ${current
                                    ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)]"
                                    : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"}`}
                                >
                                  {busy && (
                                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                  )}
                                  {busy
                                    ? t(`AI กำลังตรวจ ${waiting} ชิ้น…`, `AI grading ${waiting}…`)
                                    : m === "ai"
                                      ? (waiting > 0 ? t(`ตรวจด้วย AI (${waiting})`, `Grade with AI (${waiting})`) : t("ตรวจด้วย AI", "Grade with AI"))
                                      : t("ตรวจเอง", "Grade manually")}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </li>
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
              <li>{t("คะแนนที่คุณให้เองยังอยู่ครบ", "Scores you set yourself stay.")}</li>
              <li>{t("คะแนน AI และปุ่ม Re-grade จะถูกซ่อน", "AI scores and the Re-grade button are hidden.")}</li>
              <li>{t("เปลี่ยนกลับเป็น “ให้ AI ช่วยตรวจ” ได้ แต่ผลที่ถูกล้างจะไม่กลับมา", "You can switch back to AI-assisted, but the cleared AI results do not come back.")}</li>
            </ul>
          </>
        )}
      </Modal>
    </main>
  );
}
