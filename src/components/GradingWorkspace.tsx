"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import type { Assignment, Rubric, Submission } from "@/lib/assignments";
import type { SubmissionRow } from "@/lib/groupSubmissions";
import { attentionOf, ATTENTION_KEYS, type AssignmentInsights, type AttentionKey } from "@/lib/gradingInsights";
import { ROW_SORTS, rowFigures, sortRows, type RowSort } from "@/lib/gradingRows";
import { NOTICE_CHIP_CLASSES, SCORE_TEXT_CLASSES, SCORE_TONE_CLASSES, PENDING_CHIP_CLASSES, toneForPct } from "@/lib/scoreBook";
import type { CLO } from "@/lib/clo";
import { getInitials } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import FilterSelect from "@/components/FilterSelect";
import Icon from "@/components/Icon";
import PillTabBar from "@/components/PillTabBar";
import ScoreHistogram from "@/components/ScoreHistogram";
import SearchInput from "@/components/SearchInput";
import GradingRubricPanel from "@/components/GradingRubricPanel";
import GradingStudentDetail from "@/components/GradingStudentDetail";

export type StatusFilter = "all" | "not_graded" | "graded" | AttentionKey;
// the order they are offered in: everyone, then the work that waits, then the signals
export const FILTER_KEYS: StatusFilter[] = ["all", "need_review", "not_graded", "graded", "low", "edited", "late"];

/**
 * The Grading page's workspace (10/11/2569): the list of students (or teams) on the left, and on the right either the class overview (the score
 * chart, the lowest-scoring criteria, the rubric) or everything about the one the teacher picked. Both panes scroll inside their own frame, so the
 * page itself does not scroll on a desktop screen. Picking a row only SHOWS it — the Grade button (in the row and in the detail) is what opens the
 * grading screen. ↑ / ↓ move the selection; the choice lives in the URL (?sub=) so a reload, or coming back from grading, lands on the same person.
 */
export default function GradingWorkspace({
  rows, assignment, rubric, courseId, assignmentId, aiGraded, gradeLocked, statusFilter, onStatusFilter, selectedSubId, onSelect, onRegradeRow,
  insights, gradedSubs, clos, finalized, editHref, unit, isGroup,
}: {
  rows: SubmissionRow[];
  assignment: Assignment;
  rubric?: Rubric;
  courseId: string;
  assignmentId: string;
  aiGraded: boolean;
  gradeLocked: boolean;
  statusFilter: StatusFilter;
  onStatusFilter: (f: StatusFilter) => void;
  /** the submission id the URL points at (a team row is picked by its first member's submission) */
  selectedSubId: string | null;
  onSelect: (subId: string | null) => void;
  onRegradeRow: (row: SubmissionRow) => void;
  insights: AssignmentInsights;
  gradedSubs: Submission[];
  clos: CLO[];
  finalized: boolean;
  editHref: string;
  unit: "student" | "team";
  isGroup: boolean;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RowSort>("attention");
  const [pane, setPane] = useState<"class" | "rubric">("class");
  const [regrading, setRegrading] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const matches = (row: SubmissionRow, f: StatusFilter) =>
    f === "all" ? true
    : f === "not_graded" || f === "graded" ? row.subs[0].status === f
    : attentionOf(assignment, row.subs[0]).includes(f);
  const countBy = (f: StatusFilter) => rows.filter((r) => matches(r, f)).length;

  const q = search.trim().toLowerCase();
  const visible = sortRows(rows, assignment, aiGraded, sort).filter((row) => {
    if (!matches(row, statusFilter)) return false;
    if (!q) return true;
    return [row.teamName ?? "", ...row.subs.flatMap((s) => [s.studentName, s.email])].some((x) => x.toLowerCase().includes(q));
  });

  const selected = selectedSubId ? rows.find((r) => r.subs.some((s) => s.id === selectedSubId)) : undefined;
  const selectedIndex = selected ? visible.findIndex((r) => r.key === selected.key) : -1;
  const pick = (row: SubmissionRow | undefined) => onSelect(row ? row.subs[0].id : null);

  // keep the picked row in view when the selection moves (arrow keys, the detail's ‹ ›)
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-row-key="${CSS.escape(selected.key)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected?.key]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function regrade(row: SubmissionRow) {
    setRegrading((p) => ({ ...p, [row.key]: true }));
    await new Promise((r) => setTimeout(r, 1500));
    onRegradeRow(row);     // the AI's answer for the same work is the same every time, so a re-grade only changes when the rubric or its correction did
    setRegrading((p) => ({ ...p, [row.key]: false }));
  }

  function onRowKey(e: React.KeyboardEvent<HTMLTableRowElement>, i: number) {
    if (e.target !== e.currentTarget) return;           // a key pressed on the Grade link inside is the link's own
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = visible[i + (e.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      pick(next);
      (e.currentTarget.parentElement?.querySelector(`[data-row-key="${CSS.escape(next.key)}"]`) as HTMLElement | null)?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(visible[i]);
    }
  }

  const filterLabel = (f: StatusFilter) => {
    const n = countBy(f);
    const name = f === "all" ? t("ทั้งหมด", "All") : f === "not_graded" ? t("ยังไม่ตรวจ", "Not graded") : f === "graded" ? t("ตรวจแล้ว", "Graded")
      : f === "need_review" ? t("รอตรวจสอบ", "Needs review") : f === "low" ? t("คะแนนต่ำ", "Low score") : f === "edited" ? t("แก้จาก AI", "Edited") : t("ส่งช้า", "Late");
    return `${name} (${n})`;
  };
  const filterOptions = FILTER_KEYS.filter((f) => f === "all" || f === "not_graded" || f === "graded" || (f === "need_review" ? aiGraded || countBy(f) > 0 : countBy(f) > 0 || statusFilter === f));
  const sortLabel = (s: RowSort) =>
    s === "attention" ? t("ที่ต้องดูก่อน", "Needs attention") : s === "name" ? t("ชื่อ", "Name")
    : s === "score_desc" ? t("คะแนนมาก→น้อย", "Score high→low") : s === "score_asc" ? t("คะแนนน้อย→มาก", "Score low→high") : t("วันที่ส่ง", "Submitted");

  const frame = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:min-h-[26rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" data-testid="grading-workspace">
      {/* ── The list ── */}
      <section aria-label={t("รายชื่อ", "Students")} className={`${frame} flex min-h-0 max-h-[32rem] flex-col overflow-hidden lg:max-h-none`}>
        <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{isGroup ? t("ทีม", "Teams") : t("นักศึกษา", "Students")}</h2>
            <FilterSelect value={statusFilter} onChange={(v) => onStatusFilter(v as StatusFilter)} icon={<Icon name="filter" size="sm" />} ariaLabel={t("กรองตามสถานะ", "Filter by status")}>
              {filterOptions.map((f) => <option key={f} value={f}>{filterLabel(f)}</option>)}
            </FilterSelect>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ค้นหา...", "Search...")}
              ariaLabel={t("ค้นหานักศึกษา", "Search students")}
              suggestions={rows.flatMap((r) => r.subs.map((s) => s.studentName))}
              className="min-w-0 flex-1"
            />
            <FilterSelect value={sort} onChange={(v) => setSort(v as RowSort)} icon={<Icon name="chevrons-up-down" size="sm" />} ariaLabel={t("เรียงลำดับ", "Sort")} className="w-48">
              {ROW_SORTS.map((s) => <option key={s} value={s}>{sortLabel(s)}</option>)}
            </FilterSelect>
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--text-muted)]">{t("ยังไม่มีการส่งงาน", "No submissions yet")}</p>
          ) : (
            <table className="w-full table-fixed">
              <colgroup><col /><col className="w-20" /><col className="w-20" /></colgroup>
              <thead className="sr-only text-xs">
                <tr>
                  <th scope="col">{t("นักศึกษา", "Student")}</th>
                  <th scope="col">{t("คะแนน", "Score")}</th>
                  <th scope="col">{t("ตรวจ", "Grade")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผลการค้นหา", "No results found")}</td></tr>
                )}
                {visible.map((row, i) => {
                  const f = rowFigures(assignment, row, aiGraded);
                  const rep = f.rep;
                  const isTeam = !!row.teamName;
                  const isSel = selected?.key === row.key;
                  const mixed = new Set(row.subs.map((s) => s.status)).size > 1;
                  const status = mixed
                    ? { label: t("ไม่ตรงกัน", "Mixed"), cls: NOTICE_CHIP_CLASSES }
                    : rep.status === "graded" ? { label: t("ตรวจแล้ว", "Graded"), cls: SCORE_TONE_CLASSES.ok }
                    : rep.status === "need_review" ? { label: t("รอตรวจสอบ", "Needs review"), cls: NOTICE_CHIP_CLASSES }
                    : { label: t("ยังไม่ได้ตรวจ", "Not graded"), cls: "bg-[var(--bg-app)] text-[var(--text-secondary)]" };
                  const href = `/teacher/courses/${courseId}/assignments/${assignmentId}/recheck?sub=${rep.id}`;
                  return (
                    <tr
                      key={row.key}
                      data-row-key={row.key}
                      tabIndex={0}
                      aria-current={isSel ? "true" : undefined}
                      onClick={() => pick(row)}
                      onKeyDown={(e) => onRowKey(e, i)}
                      className={`cursor-pointer border-b border-[var(--border-subtle)] last:border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-bright)] ${isSel ? "bg-[var(--accent-subtle)] shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-[var(--bg-subtle)]"}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {!isTeam && <Avatar initials={getInitials(rep.studentName)} />}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={isTeam ? undefined : rep.email}>{isTeam ? row.teamName : rep.studentName}</p>
                            {isTeam && <p className="truncate text-xs text-[var(--text-muted)]">{row.subs.map((s) => s.studentName).join(", ")}</p>}
                            <span className="mt-1 flex flex-wrap items-center gap-1">
                              <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                              {row.subs.some((s) => s.late) && (
                                <span data-testid="late-chip" className="rounded-md border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--s-warn-text)]">
                                  {t("ส่งช้า", "Late")}{f.penalty > 0 && <span data-testid="late-penalty" className="tabular-nums"> · −{f.penalty}</span>}
                                </span>
                              )}
                              {f.edited && (
                                <span className="rounded-md border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-1.5 py-0.5 text-xs font-bold text-[var(--s-warn-text)] whitespace-nowrap">{t("แก้ไขแล้ว", "Edited")}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-baseline gap-1 rounded-lg px-2 py-0.5 tabular-nums ${f.tone ? SCORE_TONE_CLASSES[f.tone] : "text-[var(--text-secondary)]"}`}>
                            <span className="text-sm font-bold">{f.score !== null ? f.score : "—"}</span>
                            {f.score !== null && <span className="text-xs font-medium">/{assignment.maxPoints}</span>}
                          </span>
                          {f.pct !== null && f.tone && (
                            // the score as a picture too: a column of these bars reads at a glance, the number stays in the chip
                            <span aria-hidden="true" data-testid="score-bar" className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-app)]">
                              <span className={`block h-full rounded-full bg-current ${SCORE_TEXT_CLASSES[toneForPct(f.pct)]}`} style={{ width: `${Math.min(100, f.pct)}%` }} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {gradeLocked ? (
                          <span
                            data-testid="grade-locked"
                            aria-disabled="true"
                            title={t("ยังไม่เปิดให้ตรวจ — ดูเวลาเปิดที่ด้านบนของหน้า", "Grading is not open yet — see the time at the top of the page")}
                            className="inline-flex h-7 cursor-not-allowed items-center whitespace-nowrap rounded-lg border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--text-muted)]"
                          >
                            {isTeam ? t("ตรวจทั้งทีม", "Grade team") : t("ตรวจ", "Grade")}
                          </span>
                        ) : (
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-7 items-center whitespace-nowrap rounded-lg border border-[var(--accent)]/30 px-2.5 text-xs font-medium text-[var(--accent)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-bright)]/10 active:scale-[0.97]"
                          >
                            {isTeam ? t("ตรวจทั้งทีม", "Grade team") : t("ตรวจ", "Grade")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]" aria-live="polite">
            {t("แสดง", "Showing")} <span className="font-medium text-[var(--text-primary)]">1–{visible.length}</span> {t("จาก", "of")} <span className="font-medium text-[var(--text-primary)]">{visible.length}</span>{" "}
            {isGroup ? t("ทีม", "team(s)") : t("งาน", "submissions")}
          </div>
        )}
      </section>

      {/* ── The detail ── */}
      <section aria-label={t("รายละเอียด", "Details")} className={`${frame} min-h-0 overflow-y-auto`}>
        {selected ? (
          <GradingStudentDetail
            key={selected.key}
            row={selected}
            assignment={assignment}
            rubric={rubric}
            aiGraded={aiGraded}
            gradeLocked={gradeLocked}
            reviewHref={`/teacher/courses/${courseId}/assignments/${assignmentId}/recheck?sub=${selected.subs[0].id}`}
            regrading={!!regrading[selected.key]}
            onRegrade={() => regrade(selected)}
            classAvgPct={Object.fromEntries(insights.weakCriteria.map((c) => [c.criterionId, c.avgPct]))}
            position={selectedIndex >= 0 ? { index: selectedIndex, total: visible.length } : null}
            onPrev={selectedIndex > 0 ? () => pick(visible[selectedIndex - 1]) : undefined}
            onNext={selectedIndex >= 0 && selectedIndex < visible.length - 1 ? () => pick(visible[selectedIndex + 1]) : undefined}
            onBack={() => pick(undefined)}
          />
        ) : (
          <div className="flex flex-col gap-4 p-5" data-testid="class-overview">
            <PillTabBar
              ariaLabel={t("มุมมองห้อง", "Class view")}
              activeKey={pane}
              onChange={(k) => setPane(k as "class" | "rubric")}
              tabs={[
                { key: "class", label: t("ภาพรวมของห้อง", "Class overview") },
                { key: "rubric", label: t("เกณฑ์การให้คะแนน", "Rubric") },
              ]}
            />
            {pane === "class" ? (
              <>
                <section aria-labelledby="spread-h">
                  <h3 id="spread-h" className="mb-3 text-sm font-bold text-[var(--text-primary)]">{t("การกระจายคะแนน", "Score spread")}</h3>
                  {insights.scores.length > 0 && insights.mean !== null ? (
                    <ScoreHistogram scores={insights.scores} maxPoints={assignment.maxPoints} myScore={null} mean={insights.mean} />
                  ) : (
                    <p data-testid="spread-none" className="py-10 text-center text-sm text-[var(--text-muted)]">{t("ยังไม่มีคะแนน", "No scores yet")}</p>
                  )}
                </section>
                {insights.weakCriteria.length > 0 && (
                  <section aria-labelledby="weak-h" data-testid="weakest-criteria">
                    <h3 id="weak-h" className="mb-3 text-sm font-bold text-[var(--text-primary)]">{t("เกณฑ์ที่ได้คะแนนน้อย", "Lowest-scoring criteria")}</h3>
                    <ul className="flex flex-col gap-2.5">
                      {insights.weakCriteria.slice(0, 3).map((c) => (
                        <li key={c.criterionId}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-[var(--text-primary)]">{c.name}</span>
                            <span className={`font-bold tabular-nums ${SCORE_TEXT_CLASSES[toneForPct(c.avgPct)]}`}>{Math.round(c.avgPct)}%</span>
                          </div>
                          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[var(--bg-app)]">
                            <span className={`block h-full rounded-full bg-current ${SCORE_TEXT_CLASSES[toneForPct(c.avgPct)]}`} style={{ width: `${Math.min(100, c.avgPct)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="rounded-xl bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <Icon name="info" size="sm" className="mr-1.5 inline align-text-bottom" />
                  {t("เลือกแถวทางซ้ายเพื่อดูรายละเอียดของคนนั้น (ใช้ปุ่มลูกศรขึ้น/ลงเพื่อเลื่อน)", "Pick a row on the left to see that person's details; the up and down arrow keys move the selection.")}
                </p>
              </>
            ) : rubric && rubric.criteria.length > 0 ? (
              <GradingRubricPanel
                flush
                rubric={rubric}
                graded={gradedSubs}
                editHref={editHref}
                locked={finalized}
                clos={clos}
                unit={unit}
                weakestId={insights.weakCriteria[0]?.criterionId}
              />
            ) : (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">{t("งานนี้ยังไม่มีเกณฑ์การให้คะแนน", "This assignment has no rubric yet.")}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
