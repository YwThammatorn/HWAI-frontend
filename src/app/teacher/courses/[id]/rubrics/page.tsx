"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useRubricLibrary } from "@/lib/rubricLibrary";
import { rubricCandidates, compareRubricYears, type YearCell } from "@/lib/rubricHistory";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";
import { termHeading } from "@/lib/academicTerm";
import PillTabBar from "@/components/PillTabBar";
import CriterionName from "@/components/CriterionName";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";

// colours of a level on a bar, best → worst (same as the Grading rubric card; warn is never used for a level)
const FILL = ["bg-[var(--s-ok-text)]", "bg-[var(--s-info-text)]", "bg-[var(--text-muted)]", "bg-[var(--s-err-text)]"];
const toneOf = (i: number, n: number) => (n <= 1 ? 0 : Math.round((i / (n - 1)) * 3));

function LevelBar({ cell }: { cell: YearCell }) {
  const total = cell.counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div role="img" aria-label={cell.counts.map((k, i) => `${i}: ${k}`).join(", ")} className="flex h-1.5 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-app)]">
      {cell.counts.map((k, i) => k > 0 && <div key={i} className={FILL[toneOf(i, cell.counts.length)]} style={{ width: `${(k / total) * 100}%` }} />)}
    </div>
  );
}

export default function RubricsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { courses, getCourse } = useCourses();
  const { assignments, rubrics, submissions } = useAssignments();
  const { entries, addEntry, renameEntry, removeEntry } = useRubricLibrary();
  const myCourseIds = useMyCourseIds();
  const course = getCourse(id);

  const [tab, setTab] = useState<"library" | "compare">("library");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const mine = useMemo(
    () => entries.filter((e) => !e.courseTemplateId || e.courseTemplateId === course?.courseTemplateId),
    [entries, course?.courseTemplateId],
  );
  const subjectRubrics = useMemo(
    () => rubricCandidates({ courseId: id, courses, assignments, rubrics, submissions, library: [], myCourseIds }).filter((c) => c.source === "subject"),
    [id, courses, assignments, rubrics, submissions, myCourseIds],
  );

  // Compare years: which of THIS course's rubrics to follow through the years
  const ownRubricAssignments = assignments.filter((a) => a.courseId === id && !a.isExam && rubrics.some((r) => r.assignmentId === a.id));
  const [refId, setRefId] = useState<string>("");
  const referenceId = ownRubricAssignments.some((a) => a.id === refId) ? refId : ownRubricAssignments[0]?.id ?? "";
  const cmp = useMemo(
    () => (referenceId ? compareRubricYears({ referenceAssignmentId: referenceId, courses, assignments, rubrics, submissions }) : { columns: [], rows: [] }),
    [referenceId, courses, assignments, rubrics, submissions],
  );
  const colLabel = (c: (typeof cmp.columns)[number]) => (c.academicYear && c.term ? termHeading(c.academicYear, c.term, t) : t("ไม่ระบุเทอม", "No term"));

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
        {t("ไม่พบรายวิชานี้", "Course not found")} — <Link href="/teacher/courses" className="ml-1 text-[var(--accent)] hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
      </main>
    );
  }

  const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";
  const ghost = "inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <main className="w-full px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors" aria-label={t("รายวิชาทั้งหมด", "All courses")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("เกณฑ์การให้คะแนน", "Rubrics")}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("เกณฑ์การให้คะแนน (Rubrics)", "Rubrics")}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t("คลัง rubric ของวิชานี้ และผลของ rubric เดียวกันข้ามเทอม/ปี", "This subject's rubric library, and how the same rubric did across terms and years")}</p>
      </div>

      <div className="mb-5">
        <PillTabBar
          variant="boxed"
          ariaLabel={t("ส่วนของหน้า Rubrics", "Rubrics sections")}
          activeKey={tab}
          onChange={(k) => setTab(k as "library" | "compare")}
          tabs={[
            { key: "library", label: t("คลัง", "Library"), count: mine.length + subjectRubrics.length, tone: "info" },
            { key: "compare", label: t("เทียบข้ามปี", "Compare years"), count: cmp.columns.length > 1 ? cmp.columns.length : undefined, tone: "neutral" },
          ]}
        />
      </div>

      {tab === "library" && (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="lib-saved" className={card}>
            <div className="px-6 pt-5 pb-3">
              <h2 id="lib-saved" className="text-base font-bold text-[var(--text-primary)]">{t("บันทึกไว้ในคลัง", "Saved in the library")}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("เลือกใช้ได้ที่ งาน → สร้าง/แก้ไขงาน → “ใช้ rubric จากงานก่อนหน้า” → คลัง", "Use one from an assignment → “Use a rubric from before” → Library")}</p>
            </div>
            {mine.length === 0 ? (
              <p data-testid="library-empty" className="border-t border-[var(--border-subtle)] px-6 py-8 text-center text-sm text-[var(--text-secondary)]">{t("ยังไม่มี rubric ในคลัง — กด “บันทึกลงคลัง” ที่ rubric ของชิ้นงาน หรือที่รายการด้านล่าง", "Nothing saved yet — press “Save to library” on an assignment's rubric, or on one below.")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {mine.map((e) => {
                  const open = openKey === `l-${e.id}`;
                  const pts = e.criteria.reduce((n, c) => n + c.maxPoints, 0);
                  return (
                    <li key={e.id} data-testid={`library-${e.id}`} className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{e.name}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">{t(`${e.criteria.length} เกณฑ์ · ${pts} คะแนน`, `${e.criteria.length} criteria · ${pts} pts`)}{!e.courseTemplateId && ` · ${t("ใช้ได้ทุกวิชา", "any subject")}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-expanded={open} onClick={() => setOpenKey(open ? null : `l-${e.id}`)} className={ghost}>{open ? t("ซ่อนเกณฑ์", "Hide criteria") : t("ดูเกณฑ์", "View criteria")}</button>
                          <button type="button" onClick={() => setRenaming({ id: e.id, name: e.name })} className={ghost}>{t("เปลี่ยนชื่อ", "Rename")}</button>
                          <button type="button" onClick={() => setRemoving({ id: e.id, name: e.name })} className={`${ghost} hover:!bg-[var(--s-err-bg)] hover:!text-[var(--s-err-text)]`}>{t("ลบ", "Delete")}</button>
                        </div>
                      </div>
                      {open && (
                        <ul className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[var(--border-subtle)] p-4">
                          {e.criteria.map((c) => (
                            <li key={c.id} className="flex items-start justify-between gap-3">
                              <CriterionName name={c.name} />
                              <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{c.maxPoints} {t("คะแนน", "pts")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="lib-subject" className={card}>
            <div className="px-6 pt-5 pb-3">
              <h2 id="lib-subject" className="text-base font-bold text-[var(--text-primary)]">{t("rubric ของวิชานี้ในแต่ละเทอม", "This subject's rubrics, term by term")}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("เทอมล่าสุดก่อน", "Newest first")}</p>
            </div>
            {subjectRubrics.length === 0 ? (
              <p className="border-t border-[var(--border-subtle)] px-6 py-8 text-center text-sm text-[var(--text-secondary)]">{t("ยังไม่มีงานที่มี rubric ในวิชานี้", "No assignment with a rubric in this subject yet.")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {subjectRubrics.map((c) => (
                  <li key={c.key} data-testid={`subject-${c.assignmentId}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        <Link href={`/teacher/courses/${c.assignmentId ? assignments.find((a) => a.id === c.assignmentId)?.courseId : id}/assignments/${c.assignmentId}`} className="hover:text-[var(--accent)] hover:underline">{c.title}</Link>
                        {c.lastYear && <span className="ml-2 rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--s-info-text)]">{t("ปีที่แล้ว", "Last year")}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {[c.academicYear && c.term ? termHeading(c.academicYear, c.term, t) : undefined, c.sectionNumber ? t(`กลุ่ม ${c.sectionNumber}`, `Sec ${c.sectionNumber}`) : undefined].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-[var(--text-muted)]">
                        {t(`${c.criteria.length} เกณฑ์ · ${c.maxPoints} คะแนน`, `${c.criteria.length} criteria · ${c.maxPoints} pts`)}{c.avgPct !== null && ` · ${t("เฉลี่ย", "avg")} ${Math.round(c.avgPct)}%`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { addEntry({ name: c.title, courseTemplateId: course.courseTemplateId, criteria: c.criteria.map((x) => ({ ...x })), sourceAssignmentId: c.assignmentId }); setSavedKey(c.key); }}
                      disabled={savedKey === c.key}
                      className={`${ghost} disabled:opacity-60`}
                    >
                      {savedKey === c.key ? t("บันทึกแล้ว", "Saved") : t("บันทึกลงคลัง", "Save to library")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "compare" && (
        <section aria-labelledby="cmp-h" className={card}>
          <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-5 pb-4">
            <div className="min-w-0">
              <h2 id="cmp-h" className="text-base font-bold text-[var(--text-primary)]">{t("rubric เดียวกัน ข้ามเทอม/ปี", "The same rubric across terms and years")}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("จับคู่เกณฑ์จากชื่อ — วิชาเดียวกัน (รหัสวิชาเดียวกัน) ที่ชื่อเกณฑ์ตรงกัน", "Criteria are matched by name, within the same subject (same course code).")}</p>
            </div>
            {ownRubricAssignments.length > 0 && (
              <div className="flex flex-col gap-1">
                <label htmlFor="cmp-ref" className="text-xs font-semibold text-[var(--text-muted)]">{t("เทียบ rubric ของงาน", "Compare the rubric of")}</label>
                <select id="cmp-ref" value={referenceId} onChange={(e) => setRefId(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]">
                  {ownRubricAssignments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {ownRubricAssignments.length === 0 ? (
            <div className="border-t border-[var(--border-subtle)] p-6">
              <EmptyState
                iconColor="var(--accent-bright)"
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                title={t("ยังไม่มี rubric ในวิชานี้ให้เทียบ", "No rubric in this course to compare yet")}
                description={t("สร้างงานที่มี rubric ก่อน แล้วกลับมาดูว่าเทอมก่อนๆ ทำได้อย่างไร", "Create an assignment with a rubric first, then come back to see how earlier terms did.")}
              />
            </div>
          ) : cmp.columns.length < 2 ? (
            <p data-testid="compare-none" className="border-t border-[var(--border-subtle)] px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              {t("ยังไม่มี rubric ของวิชานี้ในเทอม/ปีอื่นที่ตรงกับอันนี้", "No rubric of this subject in another term or year matches this one yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
              <table data-testid="compare-table" className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-[var(--bg-app)] text-left">
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("เกณฑ์", "Criterion")}</th>
                    {cmp.columns.map((c) => (
                      <th key={c.key} scope="col" data-testid={`col-${c.assignmentId}`} className="px-4 py-3 text-left align-bottom">
                        <span className="block text-sm font-semibold text-[var(--text-primary)]">{colLabel(c)}{c.isReference && <span className="ml-1.5 text-xs font-medium text-[var(--accent)]">{t("(อันนี้)", "(this one)")}</span>}</span>
                        <span className="block text-xs font-normal text-[var(--text-secondary)]">{c.title}</span>
                        <span className="block text-xs font-normal tabular-nums text-[var(--text-muted)]">{c.avgPct !== null ? `${t("เฉลี่ยรวม", "overall avg")} ${Math.round(c.avgPct)}% (${c.gradedCount})` : t("ยังไม่มีงานที่ตรวจ", "nothing graded")}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {cmp.rows.map((row) => (
                    <tr key={row.key} data-testid={`row-${row.key.replace(/\s+/g, "-")}`}>
                      <th scope="row" className="px-6 py-3.5 text-left align-top font-normal">
                        <CriterionName name={row.name} />
                        {row.presentIn < cmp.columns.length && (
                          <span className="mt-1 ml-0 inline-block rounded-md border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--s-warn-text)]">
                            {t(`มีใน ${row.presentIn} จาก ${cmp.columns.length} rubric`, `In ${row.presentIn} of ${cmp.columns.length} rubrics`)}
                          </span>
                        )}
                      </th>
                      {cmp.columns.map((c) => {
                        const cell = row.cells[c.key];
                        return (
                          <td key={c.key} data-testid={`cell-${row.key.replace(/\s+/g, "-")}-${c.assignmentId}`} className="px-4 py-3.5 align-top">
                            {!cell ? (
                              <span className="text-xs text-[var(--text-muted)]" title={t("ไม่มีเกณฑ์นี้ใน rubric นั้น", "Not in that rubric")}>—</span>
                            ) : cell.avgPct === null ? (
                              <span className="text-xs text-[var(--text-muted)]">{t("ไม่มีคะแนน", "no scores")}</span>
                            ) : (
                              <div className="flex w-28 flex-col gap-1.5">
                                <span className={`inline-flex h-7 w-fit items-center rounded-lg px-2.5 text-xs font-semibold tabular-nums ${SCORE_TONE_CLASSES[toneForPct(cell.avgPct)]}`}>{Math.round(cell.avgPct)}%</span>
                                <LevelBar cell={cell} />
                                <span className="text-xs tabular-nums text-[var(--text-muted)]">n = {cell.n}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        size="sm"
        title={t("เปลี่ยนชื่อ rubric", "Rename rubric")}
        footer={
          <>
            <button type="button" onClick={() => setRenaming(null)} className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ยกเลิก", "Cancel")}</button>
            <button type="button" disabled={!renaming?.name.trim()} onClick={() => { if (renaming) renameEntry(renaming.id, renaming.name.trim()); setRenaming(null); }} className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("บันทึก", "Save")}</button>
          </>
        }
      >
        <label htmlFor="rename-lib" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">{t("ชื่อ rubric", "Rubric name")}</label>
        <input id="rename-lib" value={renaming?.name ?? ""} onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))} className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]" />
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        size="sm"
        title={t("ลบ rubric ออกจากคลัง?", "Delete this rubric from the library?")}
        description={removing?.name}
        footer={
          <>
            <button type="button" onClick={() => setRemoving(null)} className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ยังก่อน", "Not yet")}</button>
            <button type="button" onClick={() => { if (removing) removeEntry(removing.id); setRemoving(null); }} className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--s-err-text)] text-white text-sm font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ลบ", "Delete")}</button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{t("งานที่เคยใช้ rubric นี้ไปแล้วไม่ได้รับผลกระทบ", "Assignments that already used this rubric are not affected.")}</p>
      </Modal>
    </main>
  );
}
