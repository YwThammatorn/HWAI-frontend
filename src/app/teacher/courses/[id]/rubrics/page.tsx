"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useRubricLibrary } from "@/lib/rubricLibrary";
import { rubricCandidates, compareOptions, compareColumn, criterionOnRow, compareCell, NO_CRITERION, type YearCell, type CompareColumn, type CompareOption } from "@/lib/rubricHistory";
import { splitCriterionName } from "@/lib/rubricName";
import { levelTone } from "@/lib/rubricLevels";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";
import { termHeading } from "@/lib/academicTerm";
import PillTabBar from "@/components/PillTabBar";
import CriterionName from "@/components/CriterionName";
import EmptyState from "@/components/EmptyState";
import SearchInput from "@/components/SearchInput";
import Modal from "@/components/Modal";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
// a level's colour on a bar, best → worst: the one level ramp (lib/rubricLevels.ts), the same as the Grading rubric panel
function LevelBar({ cell }: { cell: YearCell }) {
  const total = cell.counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div role="img" aria-label={cell.counts.map((k, i) => `${i}: ${k}`).join(", ")} className="flex h-1.5 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-app)]">
      {cell.counts.map((k, i) => k > 0 && <div key={i} className={levelTone(i, cell.counts.length).dot} style={{ width: `${(k / total) * 100}%` }} />)}
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

  // Compare rubrics (14/10/2569): the teacher picks which assignments' rubrics to put side by side and which criterion sits on which row
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});   // assignment id → row index → criterion id
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const compareData = useMemo(() => ({ courses, assignments, rubrics, submissions, myCourseIds }), [courses, assignments, rubrics, submissions, myCourseIds]);
  const options = useMemo(() => compareOptions(compareData), [compareData]);
  const columns = useMemo(() => chosenIds.map((cid) => compareColumn(cid, compareData)).filter((c): c is CompareColumn => !!c), [chosenIds, compareData]);
  const rowCount = Math.max(0, ...columns.map((c) => c.criteria.length));
  const levelCounts = [...new Set(columns.map((c) => c.levelCount))].sort((x, y) => x - y);
  const colLabel = (c: Pick<CompareOption, "academicYear" | "term">) => (c.academicYear && c.term ? termHeading(c.academicYear, c.term, t) : t("ไม่ระบุเทอม", "No term"));
  const optionLine = (o: CompareOption) => [o.courseName, colLabel(o), o.sectionNumber ? t(`กลุ่ม ${o.sectionNumber}`, `Sec ${o.sectionNumber}`) : undefined].filter(Boolean).join(" · ");
  const shown = options.filter((o) => !query.trim() || `${o.title} ${o.courseName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const criterionLabel = (name: string) => { const n = splitCriterionName(name); return n.code ? `${n.code} · ${n.main}` : n.main; };

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
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("เกณฑ์การให้คะแนน", "Rubrics")}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("เกณฑ์การให้คะแนน (Rubrics)", "Rubrics")}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t("คลัง rubric ของวิชานี้ และเทียบ rubric ที่คุณเลือกเองเคียงกัน", "This subject's rubric library, and rubrics you pick side by side")}</p>
      </div>

      <div className="mb-5">
        <PillTabBar
          variant="boxed"
          ariaLabel={t("ส่วนของหน้า Rubrics", "Rubrics sections")}
          activeKey={tab}
          onChange={(k) => setTab(k as "library" | "compare")}
          tabs={[
            { key: "library", label: t("คลัง", "Library"), count: mine.length, tone: "info" },
            { key: "compare", label: t("เทียบ rubric", "Compare rubrics"), count: columns.length > 1 ? columns.length : undefined, tone: "neutral" },
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
              <h2 id="cmp-h" className="text-base font-bold text-[var(--text-primary)]">{t("เทียบ rubric ที่คุณเลือก", "Compare the rubrics you pick")}</h2>
              <p className="mt-0.5 max-w-2xl text-xs text-[var(--text-muted)]">{t("เพิ่ม rubric ของงานใดก็ได้ในวิชาของคุณ (ต่างปีหรือต่างวิชาก็ได้) แล้วเลือกเองว่าเกณฑ์ไหนอยู่แถวเดียวกัน — ระบบไม่จับคู่จากชื่อให้ จึงไม่พลาดเพราะตั้งชื่อไม่เหมือนกัน", "Add the rubric of any assignment in your courses (another year or another subject is fine) and choose which criterion sits on which row — nothing is matched by name, so a different name never drops a criterion out.")}</p>
            </div>
            <button type="button" data-testid="cmp-add" onClick={() => { setQuery(""); setAddOpen(true); }} disabled={columns.length >= 4} className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {columns.length >= 4 ? t("เทียบได้สูงสุด 4 รายการ", "Up to 4 at a time") : t("เพิ่มรายการเทียบ", "Add a rubric to compare")}
            </button>
          </div>

          {options.length === 0 ? (
            <div className="border-t border-[var(--border-subtle)] p-6">
              <EmptyState
          icon="bar-chart"
                title={t("ยังไม่มี rubric ให้เทียบ", "No rubric to compare yet")}
                description={t("สร้างงานที่มี rubric ก่อน แล้วกลับมาเลือกเทียบ", "Create an assignment with a rubric first, then come back to pick it.")}
              />
            </div>
          ) : columns.length === 0 ? (
            <p data-testid="compare-none" className="border-t border-[var(--border-subtle)] px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              {t("ยังไม่ได้เลือก — กด “เพิ่มรายการเทียบ” แล้วเลือก rubric อย่างน้อย 2 รายการ", "Nothing picked yet — press “Add a rubric to compare” and pick at least 2.")}
            </p>
          ) : (
            <>
              {columns.length === 1 && (
                <p data-testid="compare-one" className="border-t border-[var(--border-subtle)] px-6 py-3 text-sm text-[var(--text-secondary)]">{t("เพิ่มอีกอย่างน้อย 1 รายการเพื่อเทียบ", "Add at least one more to compare.")}</p>
              )}
              {levelCounts.length > 1 && (
                <p data-testid="compare-levels-note" className="border-t border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-6 py-2.5 text-xs text-[var(--s-warn-text)]">
                  {t(`rubric ที่เลือกใช้จำนวนระดับต่างกัน (${levelCounts.join(" / ")} ระดับ) — แถบสีแต่ละระดับเรียงจากดีที่สุดไปแย่ที่สุดของ rubric นั้นๆ`, `The rubrics use different numbers of levels (${levelCounts.join(" / ")}) — each bar runs from the best to the worst level of its own rubric.`)}
                </p>
              )}
              <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
                <table data-testid="compare-table" className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-app)] text-left">
                      <th scope="col" className="w-28 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("แถว", "Row")}</th>
                      {columns.map((c) => (
                        <th key={c.assignmentId} scope="col" data-testid={`col-${c.assignmentId}`} className="px-4 py-3 text-left align-bottom">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[var(--text-primary)]">{c.title}</span>
                              <span className="block text-xs font-normal text-[var(--text-secondary)]">{optionLine(c)}</span>
                              <span className="block text-xs font-normal tabular-nums text-[var(--text-muted)]">
                                {t(`${c.criteria.length} เกณฑ์ · ${c.levelCount} ระดับ`, `${c.criteria.length} criteria · ${c.levelCount} levels`)}
                                {" · "}
                                {c.avgPct !== null ? `${t("เฉลี่ยรวม", "overall avg")} ${Math.round(c.avgPct)}% (${c.gradedCount})` : t("ยังไม่มีงานที่ตรวจ", "nothing graded")}
                              </span>
                            </span>
                            <IconButton icon="x" label={t(`เอา ${c.title} ออกจากการเทียบ`, `Remove ${c.title} from the comparison`)} onClick={() => setChosenIds((ids) => ids.filter((x) => x !== c.assignmentId))} className="mt-0.5" />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {Array.from({ length: rowCount }, (_, ri) => (
                      <tr key={ri} data-testid={`row-${ri}`}>
                        <th scope="row" className="px-6 py-3.5 text-left align-top text-xs font-semibold text-[var(--text-muted)]">{t(`เกณฑ์ที่ ${ri + 1}`, `Criterion ${ri + 1}`)}</th>
                        {columns.map((c) => {
                          const cid = criterionOnRow(c, ri, overrides[c.assignmentId]);
                          const cell = cid === NO_CRITERION ? undefined : compareCell(c, cid);
                          return (
                            <td key={c.assignmentId} data-testid={`cell-${ri}-${c.assignmentId}`} className="px-4 py-3.5 align-top">
                              <select
                                data-testid={`map-${ri}-${c.assignmentId}`}
                                aria-label={t(`เกณฑ์ที่อยู่แถวที่ ${ri + 1} ของ ${c.title}`, `Criterion on row ${ri + 1} of ${c.title}`)}
                                value={cid}
                                onChange={(e) => setOverrides((o) => ({ ...o, [c.assignmentId]: { ...(o[c.assignmentId] ?? {}), [String(ri)]: e.target.value } }))}
                                className="mb-2 h-9 w-full max-w-[16rem] rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                              >
                                <option value={NO_CRITERION}>{t("— ไม่เทียบแถวนี้ —", "— nothing on this row —")}</option>
                                {c.criteria.map((k) => <option key={k.id} value={k.id}>{criterionLabel(k.name)}</option>)}
                              </select>
                              {!cell ? (
                                <span className="block text-xs text-[var(--text-muted)]">{cid === NO_CRITERION ? "—" : t("ไม่มีคะแนน", "no scores")}</span>
                              ) : cell.avgPct === null ? (
                                <span className="block text-xs text-[var(--text-muted)]">{t("ไม่มีคะแนน", "no scores")}</span>
                              ) : (
                                <div className="flex w-28 flex-col gap-1.5">
                                  <span className={`inline-flex h-7 w-fit items-center rounded-lg px-2.5 text-xs font-semibold tabular-nums ${SCORE_TONE_CLASSES[toneForPct(cell.avgPct)]}`}>{Math.round(cell.avgPct)}%</span>
                                  <LevelBar cell={cell} />
                                  <span className="text-xs tabular-nums text-[var(--text-muted)]">n = {cell.n} · {t("เต็ม", "max")} {cell.maxPoints}</span>
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
            </>
          )}
        </section>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        size="lg"
        title={t("เพิ่มรายการเทียบ", "Add a rubric to compare")}
        description={t("เลือก rubric ของงานใดก็ได้ในวิชาของคุณ — ต่างปีหรือต่างวิชาก็ได้", "Pick the rubric of any assignment in your courses — another year or another subject is fine")}
        footer={<button type="button" onClick={() => setAddOpen(false)} className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ปิด", "Close")}</button>}
      >
        <SearchInput value={query} onChange={setQuery} placeholder={t("ค้นหางานหรือวิชา…", "Search assignments or courses…")} ariaLabel={t("ค้นหางานหรือวิชา", "Search assignments or courses")} className="mb-3" />
        {shown.length === 0 ? (
          <p data-testid="cmp-add-empty" className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">{t("ไม่พบงานที่ค้นหา", "No assignment matches.")}</p>
        ) : (
          <ul aria-label={t("rubric ที่เลือกได้", "Rubrics to choose from")} className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {shown.map((o) => {
              const taken = chosenIds.includes(o.assignmentId);
              return (
                <li key={o.assignmentId}>
                  <button
                    type="button"
                    data-testid={`cmp-opt-${o.assignmentId}`}
                    disabled={taken}
                    onClick={() => { setChosenIds((ids) => [...ids, o.assignmentId]); setAddOpen(false); }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-50 disabled:hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">{o.title}{taken && <span className="ml-2 text-xs font-medium text-[var(--text-muted)]">{t("เลือกแล้ว", "already added")}</span>}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{optionLine(o)}</span>
                    <span className="mt-1 block text-xs tabular-nums text-[var(--text-muted)]">
                      {t(`${o.criteriaCount} เกณฑ์ · ${o.levelCount} ระดับ · ${o.maxPoints} คะแนน`, `${o.criteriaCount} criteria · ${o.levelCount} levels · ${o.maxPoints} pts`)}
                      {o.avgPct !== null && ` · ${t("เฉลี่ย", "avg")} ${Math.round(o.avgPct)}% (${o.gradedCount})`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

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
