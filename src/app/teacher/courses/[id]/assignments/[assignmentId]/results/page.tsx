"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, Submission, finalScoreOf } from "@/lib/assignments";
import { useStudentGroups } from "@/lib/studentGroups";
import { groupSubmissionsByTeam, SubmissionRow } from "@/lib/groupSubmissions";
import { useLanguage } from "@/context/LanguageContext";
import { useCan } from "@/lib/useCan";
import SearchInput from "@/components/SearchInput";
import ExamStatsCard from "@/components/ExamStatsCard";
import { statsFromScores } from "@/lib/examStats";
import { SCORE_TONE_CLASSES } from "@/lib/scoreBook";

import Icon from "@/components/Icon";
import MetricCard from "@/components/MetricCard";
import Avatar from "@/components/Avatar";
const AVATAR_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();
}

export default function ResultsPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { t, lang } = useLanguage();
  const can = useCan();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment } = useAssignments();
  const { getGroupsByAssignment } = useStudentGroups();

  const [search, setSearch] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const allSubs = getSubmissionsByAssignment(assignmentId);

  if (!course || !assignment) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้างาน", "Back to assignments")}
          </Link>
        </main>
    );
  }

  const max = assignment.maxPoints;
  // the score that counts: the marks minus any late deduction (Assignment.latePolicy)
  const fin = (s: Submission) => finalScoreOf(assignment, s);
  const sc = (s: Submission) => fin(s) ?? 0;
  const isGroupAssignment = assignment.submissionType === "group";
  const groups = isGroupAssignment ? getGroupsByAssignment(assignmentId) : [];

  // Group assignments: one row per team instead of one row per student — a
  // team submits once, so its score/status is shared across every member
  // (RecheckPage.handleSave fans grading out to the whole group already).
  const rows: SubmissionRow[] = isGroupAssignment
    ? groupSubmissionsByTeam(allSubs, groups, t("ทีม", "Team"))
    : allSubs.map((s) => ({ key: s.id, subs: [s] }));
  const repRows = rows.map((r) => ({
    key: r.key,
    rep: r.subs[0],
    displayName: r.teamName ?? r.subs[0].studentName,
    isTeam: !!r.teamName,
    members: r.subs,
  }));

  const scoredRows = repRows.filter((r) => r.rep.aiScore !== null || r.rep.instructorScore !== null);
  const avgScore =
    scoredRows.length > 0
      ? scoredRows.reduce((sum, r) => sum + (sc(r.rep)), 0) / scoredRows.length
      : null;

  // Exam: the same class-statistics card (with the bell curve) a student gets once the results are announced.
  const examStats = assignment.isExam
    ? statsFromScores(allSubs.filter((s) => s.status === "graded").map((s) => sc(s)))
    : null;

  const filtered = repRows.filter((r) =>
    r.displayName.toLowerCase().includes(search.toLowerCase()) ||
    r.members.some((s) => s.studentName.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
  );

  const requiresAttention = [...scoredRows]
    .filter((r) => ((sc(r.rep)) / max) * 100 < 60)
    .sort((a, b) => (sc(a.rep)) - (sc(b.rep)))
    .slice(0, 3);

  const topPerformer = scoredRows.length > 0
    ? scoredRows.reduce((best, r) =>
        (sc(r.rep)) > (sc(best.rep)) ? r : best
      )
    : null;

  function exportCSV() {
    const rows = [
      ["Student Name", "Email", "Score", "Max", "Status"],
      ...allSubs.map((s) => {
        const score = fin(s) ?? "";
        return [s.studentName, s.email, score, max, s.status];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assignment?.name ?? "results"}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    {
      labelTh: "ตรวจแล้ว",
      labelEn: "Processed",
      value: repRows.filter((r) => r.rep.status === "graded").length,
      subTh: "เสร็จสิ้น",
      subEn: "completed",
      tone: "ok" as const,
      icon: "check" as const,
    },
    {
      labelTh: isGroupAssignment ? "ทีมทั้งหมด" : "ไฟล์ทั้งหมด",
      labelEn: isGroupAssignment ? "Total Teams" : "Total Files",
      value: repRows.length,
      subTh: isGroupAssignment ? "ทีม" : "ไฟล์ที่ส่ง",
      subEn: isGroupAssignment ? "team(s)" : "submissions",
      tone: "neutral" as const,
      icon: "file-text" as const,
    },
    {
      labelTh: "รอตรวจสอบ",
      labelEn: "Needs Review",
      value: repRows.filter((r) => r.rep.status === "need_review").length,
      subTh: "รอดำเนินการ",
      subEn: "Pending",
      tone: "warn" as const,
      icon: "alert-triangle" as const,
    },
    {
      // Three small blocks (9/11/2569): average · highest · lowest; the full score is in the label.
      labelTh: `คะแนน (เต็ม ${max})`,
      labelEn: `Score (of ${max})`,
      partsTh: [["เฉลี่ย", avgScore !== null ? avgScore.toFixed(1) : "—"], ["สูงสุด", scoredRows.length > 0 ? Math.max(...scoredRows.map((r) => sc(r.rep))) : "—"], ["ต่ำสุด", scoredRows.length > 0 ? Math.min(...scoredRows.map((r) => sc(r.rep))) : "—"]] as [string, string | number][],
      partsEn: [["Average", avgScore !== null ? avgScore.toFixed(1) : "—"], ["Highest", scoredRows.length > 0 ? Math.max(...scoredRows.map((r) => sc(r.rep))) : "—"], ["Lowest", scoredRows.length > 0 ? Math.min(...scoredRows.map((r) => sc(r.rep))) : "—"]] as [string, string | number][],
      tone: "rating" as const,
      icon: "star" as const,
    },
  ];

  return (
      <main className="w-full px-8 py-8">
        {/* Back link */}
        <Link
          href={`/teacher/courses/${id}/assignments/${assignmentId}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mb-4"
        >
          <Icon name="chevron-left" size="sm" />
          {t("กลับหน้างาน", "Back to Assignments")}
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              {t("ผลการตรวจ", "Grading Result")} : {assignment.name}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {t("ตรวจเมื่อ", "Graded on")}{" "}
              {new Date().toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
              {t("เวลา 23:59 น.", "at 11:59 PM")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/teacher/courses/${id}/assignments`}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              {t("กลับรายวิชา", "Back to Course")}
            </Link>
            {can.exportScores && <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
            >
              <Icon name="upload" />
              {t("ส่งออกผลลัพธ์", "Export Result")}
            </button>}
          </div>
        </div>

        {/* Exam: what the students see */}
        {assignment.isExam && (
          <section className="mb-6" aria-labelledby="exam-view-h">
            <h2 id="exam-view-h" className="sr-only">{t("สถิติการสอบ", "Exam statistics")}</h2>
            <p
              role="status"
              className={`mb-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${assignment.gradingFinalized ? "border-[var(--s-ok-bd)] bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]" : "border-[var(--s-info-bd)] bg-[var(--s-info-bg)] text-[var(--s-info-text)]"}`}
            >
              {assignment.gradingFinalized
                ? t("ประกาศผลแล้ว — นักศึกษาแต่ละคนเห็นการ์ดสถิติด้านล่างนี้ในหน้าของตัวเอง พร้อมคะแนนของตัวเองและตำแหน่งในห้อง", "Results announced — each student sees the statistics below on their own page, together with their own score and where they stand in the class.")
                : t("ยังไม่ประกาศผล — นักศึกษายังไม่เห็นการ์ดสถิติด้านล่างนี้จนกว่าจะประกาศผลที่หน้า Grading", "Not announced yet — students don't see the statistics below until you announce the results on the Grading page.")}
            </p>
            {examStats ? (
              <ExamStatsCard
                name={assignment.name}
                maxPoints={max}
                stats={examStats}
                myScore={null}
                badge={
                  <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-semibold ${assignment.gradingFinalized ? SCORE_TONE_CLASSES.ok : SCORE_TONE_CLASSES.info}`}>
                    {assignment.gradingFinalized ? t("ประกาศผลแล้ว", "Announced") : t("ยังไม่ประกาศ", "Not announced")}
                  </span>
                }
              />
            ) : (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
                {t("ยังไม่มีคะแนนสอบ", "No exam scores yet")}
              </div>
            )}
          </section>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => (
            <MetricCard key={s.icon} label={lang === "th" ? s.labelTh : s.labelEn} value={s.value} sub={lang === "th" ? s.subTh : s.subEn} parts={(lang === "th" ? s.partsTh : s.partsEn)?.map(([label, value]) => ({ label, value }))} tone={s.tone} icon={s.icon} />
          ))}
        </div>

        {/* Main content */}
        <div className="flex gap-5">
          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Student results table */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {t("ผลลัพธ์นักศึกษา", "Student Results")}
                </h2>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t("ค้นหานักศึกษา...", "Search student...")}
                  suggestions={repRows.map((r) => r.displayName)}
                  className="w-44"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
                  {search
                    ? t("ไม่พบนักศึกษาที่ค้นหา", "No students found")
                    : t("ยังไม่มีการส่งงาน", "No submissions yet")}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                      <th className="px-6 py-3">{t("ชื่อนักศึกษา", "Student Name")}</th>
                      <th className="px-6 py-3">{t("คะแนน", "Score")}</th>
                      <th className="px-6 py-3">{t("ดำเนินการ", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filtered.map((r) => {
                      const score = fin(r.rep);
                      return (
                        <tr key={r.key} className="hover:bg-[var(--bg-subtle)]/50 transition-colors">
                          <td className="px-6 py-3 max-w-[22rem]">
                            {r.isTeam ? (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Icon name="users" size="xs" className="text-[var(--role-ta-text)]" />
                                  <p className="font-medium text-[var(--text-primary)] text-sm">{r.displayName}</p>
                                </div>
                                <div className="flex items-center">
                                  {r.members.map((s, idx) => (
                                    <div
                                      key={s.id}
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 border-2 border-[var(--bg-surface)]"
                                      style={{ backgroundColor: avatarColor(s.studentName), marginLeft: idx > 0 ? "-8px" : 0 }}
                                      title={s.studentName}
                                    >
                                      {initials(s.studentName)}
                                    </div>
                                  ))}
                                  <p className="text-xs text-[var(--text-muted)] ml-2 truncate min-w-0">
                                    {r.members.map((s) => s.studentName).join(", ")}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <Avatar initials={initials(r.rep.studentName)} bg={avatarColor(r.rep.studentName)} />
                                <div>
                                  <p className="font-medium text-[var(--text-primary)] text-sm">{r.rep.studentName}</p>
                                  <p className="text-xs text-[var(--text-muted)]">{r.rep.email}</p>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {score !== null ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {score}/{max}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">{t("ยังไม่ได้ตรวจ", "Not graded")}</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              {r.rep.status === "need_review" ? (
                                <>
                                  <Link
                                    href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${r.rep.id}`}
                                    className="text-xs text-[var(--s-warn-text)] hover:underline font-medium"
                                  >
                                    {t("ตรวจสอบ", "Review")}
                                  </Link>
                                  <Link
                                    href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${r.rep.id}`}
                                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-semibold transition-colors"
                                  >
                                    {r.isTeam ? t("ขอให้ตรวจใหม่ทั้งทีม", "Recheck team") : t("ขอให้ตรวจใหม่", "Recheck")}
                                  </Link>
                                </>
                              ) : (
                                <Link
                                  href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${r.rep.id}`}
                                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                                >
                                  {t("ดูรายละเอียด", "View Details")}
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-64 shrink-0 space-y-4">
            {/* Requires attention */}
            {requiresAttention.length > 0 && (
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
                  {t("ต้องตรวจสอบ", "Requires Attention")}
                </p>
                <div className="space-y-2">
                  {requiresAttention.map((r) => {
                    const score = sc(r.rep);
                    return (
                      <div
                        key={r.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--s-err-bg)] border border-[var(--s-err-bd)]"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{r.displayName}</p>
                          <p className="text-xs text-[var(--s-err-text)]">
                            {t("คะแนน", "Score")}: {score}/{max}
                          </p>
                        </div>
                        <Link
                          href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${r.rep.id}`}
                          className="text-xs text-[var(--accent)] font-medium hover:underline shrink-0"
                        >
                          {t("ดู", "View")}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top performer */}
            {topPerformer && (
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
                  {t("ผู้ที่ทำได้ดีที่สุด", "Top Performer")}
                </p>
                <div className="p-3 rounded-xl bg-[var(--s-ok-bg)] border border-[var(--s-ok-bd)]">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{topPerformer.displayName}</p>
                  <p className="text-xs text-[var(--s-ok-text)] font-medium mt-0.5">
                    {t("คะแนน", "Score")}: {fin(topPerformer.rep)}/{max}
                  </p>
                </div>
              </div>
            )}

            {/* AI Feedback — star rating removed 22/9/2569 */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
                {t("ให้ Feedback AI", "Provide AI Feedback")}
              </p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                placeholder="แชร์ความคิดเห็นเกี่ยวกับคุณภาพการตรวจของ AI..."
                className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={() => { setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000); }}
                className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-semibold transition-colors"
              >
                {feedbackSent ? <><Icon name="check" size="sm" />{t("ส่งแล้ว!", "Sent!")}</> : t("ส่ง Feedback", "Feedback Grading")}
              </button>
            </div>
          </div>
        </div>
      </main>
  );
}
