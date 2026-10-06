"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { toneForPct, SCORE_TONE_CLASSES, PENDING_CHIP_CLASSES, MISSING_CHIP_CLASSES, type ScoreBook, type ScoreTone } from "@/lib/scoreBook";
import { LETTERS, type AssignmentState, type AssignmentSummary, type Letter, type ScoreSummary } from "@/lib/scoreSummary";
import ExamStatsCard from "@/components/ExamStatsCard";

const NEUTRAL_CHIP = "bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border)]";
const BAR_FILL: Record<ScoreTone, string> = { ok: "bg-[var(--s-ok-text)]", info: "bg-[var(--s-info-text)]", err: "bg-[var(--s-err-text)]" };
// A letter's colour is the band it stands for (A ≥ 80 → ok, B/C 60–79 → info, D/F → err) — same bands as the matrix.
const LETTER_TONE: Record<Letter, ScoreTone> = { A: "ok", B: "info", C: "info", D: "err", F: "err" };
const LETTER_RANGE: Record<Letter, string> = { A: "≥ 80%", B: "70–79%", C: "60–69%", D: "50–59%", F: "< 50%" };

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const ATTENTION_PREVIEW = 6;

function StateChip({ s }: { s: AssignmentSummary }) {
  const { t } = useLanguage();
  const chip = "inline-flex items-center h-7 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap";
  const map: Record<AssignmentState, { cls: string; label: string }> = {
    announced: { cls: SCORE_TONE_CLASSES.ok, label: t("ประกาศผลแล้ว", "Announced") },
    ready: { cls: SCORE_TONE_CLASSES.info, label: t("พร้อมประกาศ", "Ready to announce") },
    grading: { cls: PENDING_CHIP_CLASSES, label: s.pending > 0 ? t(`รอตรวจ ${s.pending}`, `${s.pending} to grade`) : t("กำลังตรวจ", "Grading") },
    none: { cls: NEUTRAL_CHIP, label: t("ยังไม่เริ่มตรวจ", "Not started") },
  };
  return <span className={`${chip} ${map[s.state].cls}`}>{map[s.state].label}</span>;
}

/**
 * The teacher's class summary for one section: how the room is doing overall, the grade spread, who needs a
 * nudge, and one line per assignment. Same cards and bell curve the student sees on their own Evaluation page —
 * minus the "you" marker, plus what only a teacher needs (who to follow up, what is still unannounced).
 */
export default function ScoreSummaryView({ courseId, book, summary, onShowStudent }: {
  courseId: string;
  book: ScoreBook;
  summary: ScoreSummary;
  /** Jump to the matrix filtered to this student. */
  onShowStudent: (studentId: string) => void;
}) {
  const { t } = useLanguage();
  const [showAllAttention, setShowAllAttention] = useState(false);
  const total = book.rows.length;
  const maxCount = Math.max(1, ...LETTERS.map((l) => summary.gradeCounts[l]), summary.ungraded);
  const attention = showAllAttention ? summary.attention : summary.attention.slice(0, ATTENTION_PREVIEW);
  const exams = summary.categories.flatMap((c) => c.assignments).filter((a) => a.assignment.isExam && a.stats);
  const showGroupHeaders = !(summary.categories.length === 1 && summary.categories[0].category === null);

  const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";
  const th = "px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] whitespace-nowrap";

  return (
    <div className="space-y-6" data-testid="score-summary">
      {/* Overall: spread of every student's running grade */}
      {summary.overall ? (
        <ExamStatsCard
          name={t("เกรดสะสมของห้อง", "Class running grade")}
          maxPoints={100}
          unit="%"
          stats={summary.overall}
          myScore={null}
        />
      ) : (
        <div className={`${card} px-6 py-10 text-center text-sm text-[var(--text-secondary)]`}>
          {t("ยังไม่มีงานที่ตรวจแล้ว — เมื่อตรวจงานแล้ว สรุปของห้องจะขึ้นที่นี่", "Nothing is graded yet — the class summary appears here once you grade some work")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grade spread */}
        <section className={`${card} p-5`} aria-labelledby="grade-spread-h">
          <h2 id="grade-spread-h" className="text-base font-bold text-[var(--text-primary)]">{t("การกระจายเกรด", "Grade distribution")}</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--text-muted)]">{t("เกรดสะสมเท่าที่ตรวจแล้ว ของนักศึกษาที่ยังเรียนอยู่", "Running grade so far, enrolled students only")}</p>
          <ul className="space-y-2.5">
            {LETTERS.map((l) => {
              const n = summary.gradeCounts[l];
              return (
                <li key={l} className="flex items-center gap-3" data-testid={`grade-row-${l}`}>
                  <span className={`inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${SCORE_TONE_CLASSES[LETTER_TONE[l]]}`}>{l}</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-app)]" aria-hidden="true">
                    {n > 0 && <div className={`hwai-bar-grow h-full rounded-full ${BAR_FILL[LETTER_TONE[l]]}`} style={{ width: `${(n / maxCount) * 100}%` }} />}
                  </div>
                  <span className="w-36 shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-[var(--text-primary)]">
                    <span className="font-semibold">{n}</span>
                    <span className="text-[var(--text-muted)]"> {n === 1 ? t("คน", "student") : t("คน", "students")} · {total > 0 ? Math.round((n / total) * 100) : 0}%</span>
                  </span>
                  <span className="hidden w-16 shrink-0 text-xs tabular-nums text-[var(--text-muted)] sm:block">{LETTER_RANGE[l]}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-2.5" data-testid="grade-row-none">
              <span className={`inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${NEUTRAL_CHIP}`}>—</span>
              <span className="flex-1 text-sm text-[var(--text-secondary)]">{t("ยังไม่มีงานที่ตรวจแล้ว", "Nothing graded yet")}</span>
              <span className="w-36 shrink-0 text-right text-sm tabular-nums font-semibold text-[var(--text-primary)]">{summary.ungraded}</span>
              <span className="hidden w-16 shrink-0 sm:block" />
            </li>
          </ul>
        </section>

        {/* Who needs a nudge */}
        <section className={`${card} p-5`} aria-labelledby="attention-h">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="attention-h" className="text-base font-bold text-[var(--text-primary)]">{t("ควรติดตาม", "Needs follow-up")}</h2>
              <p className="mt-0.5 mb-4 text-xs text-[var(--text-muted)]">{t("เกรดสะสมต่ำกว่า 60% หรือมีงานที่เลยกำหนดแล้วไม่ส่ง", "Running grade under 60%, or work past its due date that was never handed in")}</p>
            </div>
            {summary.attention.length > 0 && (
              <span className={`inline-flex h-7 shrink-0 items-center rounded-lg px-2.5 text-xs font-bold tabular-nums ${PENDING_CHIP_CLASSES}`} data-testid="attention-count">{summary.attention.length}</span>
            )}
          </div>
          {summary.attention.length === 0 ? (
            <p className={`rounded-xl px-4 py-6 text-center text-sm font-medium ${SCORE_TONE_CLASSES.ok}`}>{t("ไม่มีใครต้องติดตามตอนนี้", "Nobody needs a follow-up right now")}</p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--border-subtle)]" data-testid="attention-list">
                {attention.map(({ row, lowGrade, missing }) => (
                  <li key={row.student.studentId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {row.student.title && <span className="font-normal text-[var(--text-secondary)]">{row.student.title} </span>}
                        {row.student.firstName} {row.student.lastName}
                      </p>
                      <p className="text-xs tabular-nums text-[var(--text-muted)]">{row.student.studentId}</p>
                    </div>
                    {row.normalized !== null && (
                      <span className={`inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold tabular-nums ${SCORE_TONE_CLASSES[toneForPct(row.normalized)]}`} title={t("เกรดสะสม", "Running grade")}>
                        {Math.round(row.normalized)}%
                      </span>
                    )}
                    {missing > 0 && (
                      <span className={`inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold ${MISSING_CHIP_CLASSES}`}>
                        {t(`ไม่ส่ง ${missing}`, `${missing} missing`)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onShowStudent(row.student.studentId)}
                      className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                      aria-label={t(`ดู ${row.student.firstName} ${row.student.lastName} ในตารางคะแนน`, `See ${row.student.firstName} ${row.student.lastName} in the score matrix`)}
                    >
                      {t("ดูในตาราง", "View in matrix")}
                    </button>
                  </li>
                ))}
              </ul>
              {summary.attention.length > ATTENTION_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllAttention((v) => !v)}
                  className="mt-3 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                >
                  {showAllAttention ? t("แสดงน้อยลง", "Show fewer") : t(`แสดงทั้งหมด ${summary.attention.length} คน`, `Show all ${summary.attention.length}`)}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* One line per assignment, grouped by grading category */}
      <section aria-labelledby="by-assignment-h">
        <h2 id="by-assignment-h" className="text-base font-bold text-[var(--text-primary)] mb-1">{t("สรุปรายชิ้นงาน", "By assignment")}</h2>
        <p className="text-xs text-[var(--text-muted)] mb-3">{t("คะแนนเป็นคะแนนดิบของแต่ละงาน · แถบแสดงช่วงต่ำสุด–สูงสุด และขีดค่าเฉลี่ย", "Raw points per assignment · the bar spans the lowest to the highest score, with a tick at the average")}</p>
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[860px] table-fixed text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className={`${th} w-[26%] text-left`}>{t("ชิ้นงาน", "Assignment")}</th>
                <th scope="col" className={`${th} w-[15%] text-left`}>{t("สถานะ", "Status")}</th>
                <th scope="col" className={`${th} w-[10%] text-left`}>{t("ตรวจแล้ว", "Graded")}</th>
                <th scope="col" className={`${th} w-[8%] text-left`}>{t("ต่ำสุด", "Min")}</th>
                <th scope="col" className={`${th} w-[10%] text-left`}>{t("เฉลี่ย", "Average")}</th>
                <th scope="col" className={`${th} w-[8%] text-left`}>{t("สูงสุด", "Max")}</th>
                <th scope="col" className={`${th} w-[7%] text-left`}>SD</th>
                <th scope="col" className={`${th} w-[16%] text-left`}>{t("ช่วงคะแนน", "Range")}</th>
              </tr>
            </thead>
            {summary.categories.map((c, ci) => (
              <tbody key={c.key}>
                {showGroupHeaders && (
                  <tr>
                    <td colSpan={8} className="px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                          {c.category ? <>{c.category.name} · {c.category.weight}%</> : t("ไม่มีหมวด", "No category")}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                          {c.avgPct !== null
                            ? <>{t("เฉลี่ยของห้อง", "Class average")} <span className="font-semibold text-[var(--text-primary)]">{Math.round(c.avgPct)}%</span></>
                            : <span className="text-[var(--text-muted)]">{c.category ? t("ยังไม่มีคะแนน", "Not graded yet") : t("ไม่รวมในคะแนนรวม", "Excluded from the total")}</span>}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {c.assignments.map((s, ai) => {
                  const a = s.assignment;
                  const last = ci === summary.categories.length - 1 && ai === c.assignments.length - 1;
                  const cell = `px-4 py-2.5 ${last ? "" : "border-b border-[var(--border-subtle)]"}`;
                  const st = s.stats;
                  const avgPct = st && a.maxPoints > 0 ? (st.mean / a.maxPoints) * 100 : null;
                  const at = (v: number) => (a.maxPoints > 0 ? Math.min(100, Math.max(0, (v / a.maxPoints) * 100)) : 0);
                  return (
                    <tr key={a.id} data-testid={`asg-row-${a.id}`}>
                      <td className={cell}>
                        <Link
                          href={`/teacher/courses/${courseId}/assignments/${a.id}/grading`}
                          title={a.name}
                          className="block truncate font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                        >
                          {a.name}
                        </Link>
                        <span className="block text-xs tabular-nums text-[var(--text-muted)]">
                          {a.maxPoints} {t("คะแนน", "pts")}{a.isExam ? ` · ${t("สอบ", "Exam")}` : ""}{a.submissionType === "group" ? ` · ${t("กลุ่ม", "group")}` : ""}
                        </span>
                      </td>
                      <td className={cell}><StateChip s={s} /></td>
                      <td className={`${cell} tabular-nums text-[var(--text-secondary)]`}>
                        <span className="font-semibold text-[var(--text-primary)]">{s.graded}</span> / {s.students}
                        {s.missing > 0 && <span className="block text-xs text-[var(--s-err-text)]">{t(`ไม่ส่ง ${s.missing}`, `${s.missing} missing`)}</span>}
                      </td>
                      <td className={`${cell} tabular-nums text-[var(--text-primary)]`}>{st ? num(st.min) : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className={cell}>
                        {st && avgPct !== null ? (
                          <span className={`inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums ${SCORE_TONE_CLASSES[toneForPct(avgPct)]}`}>{st.mean.toFixed(1)}</span>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className={`${cell} tabular-nums text-[var(--text-primary)]`}>{st ? num(st.max) : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className={`${cell} tabular-nums text-[var(--text-secondary)]`}>{st && st.sd !== null ? st.sd.toFixed(1) : <span className="text-[var(--text-muted)]">—</span>}</td>
                      <td className={cell}>
                        {st ? (
                          <div
                            role="img"
                            aria-label={t(`ต่ำสุด ${num(st.min)} เฉลี่ย ${st.mean.toFixed(1)} สูงสุด ${num(st.max)} จาก ${a.maxPoints}`, `lowest ${num(st.min)}, average ${st.mean.toFixed(1)}, highest ${num(st.max)} out of ${a.maxPoints}`)}
                            className="relative h-6"
                          >
                            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-app)]" />
                            <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--accent-bright)]/35" style={{ left: `${at(st.min)}%`, width: `${Math.max(at(st.max) - at(st.min), 1.5)}%` }} />
                            <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text-secondary)]" style={{ left: `${at(st.mean)}%` }} />
                          </div>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {/* Exams get the full treatment — the same card (and bell curve) students see once announced */}
      {exams.length > 0 && (
        <section aria-labelledby="exam-stats-h">
          <h2 id="exam-stats-h" className="text-base font-bold text-[var(--text-primary)] mb-1">{t("สถิติการสอบ", "Exam statistics")}</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">{t("นักศึกษาเห็นการ์ดนี้ในหน้าผลการประเมินของตัวเอง หลังจากคุณประกาศผลสอบแล้วเท่านั้น", "Students see this card on their own Evaluation page, but only after you announce the exam results")}</p>
          <div className="grid gap-4">
            {exams.map((s) => (
              <ExamStatsCard
                key={s.assignment.id}
                name={s.assignment.name}
                maxPoints={s.assignment.maxPoints}
                stats={s.stats!}
                myScore={null}
                headingTag="h3"
                badge={<StateChip s={s} />}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
