"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, isManualGrading, submissionAttachments, levelShare, type Assignment } from "@/lib/assignments";
import { useStudents, withdrawnIds } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { groupSubmissionsByTeam } from "@/lib/groupSubmissions";
import { useCalibrations, pickSample, compare, suggestOffsets, suggestRubricChanges, aiLevelsFor, MAX_OFFSET, type CalibrationRun, type WorkUnit, type CriterionComparison } from "@/lib/calibration";
import CriterionName from "@/components/CriterionName";
import EmptyState from "@/components/EmptyState";

const MIN_SAMPLES = 3, MAX_SAMPLES = 10, DEFAULT_SAMPLES = 5;

const VERDICT_TONE: Record<CriterionComparison["verdict"], string> = {
  aligned: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]",
  lenient: "bg-[var(--s-info-bg)] text-[var(--s-info-text)] border-[var(--s-info-bd)]",
  strict: "bg-[var(--s-info-bg)] text-[var(--s-info-text)] border-[var(--s-info-bd)]",
  inconsistent: "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border-[var(--s-err-bd)]",
};

export default function CalibrationPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { assignments, submissions, rubrics, updateRubric } = useAssignments();
  const { getStudentsByCourse } = useStudents();
  const { getGroupsByAssignment } = useStudentGroups();
  const { runs, saveRun, removeRun } = useCalibrations();
  const course = getCourse(id);

  const roster = getStudentsByCourse(id);
  const withdrawn = withdrawnIds(roster);

  // the work of an assignment as units (a team is one unit)
  const unitsOf = (a: Assignment): WorkUnit[] => {
    const subs = submissions.filter((s) => s.assignmentId === a.id && !withdrawn.has(s.studentId));
    if (a.submissionType === "group") return groupSubmissionsByTeam(subs, getGroupsByAssignment(a.id), t("ทีม", "Team")).map((r) => ({ key: r.key, name: r.teamName ?? r.subs[0].studentName, subs: r.subs }));
    return subs.map((s) => ({ key: s.id, name: s.studentName, subs: [s] }));
  };
  const rubricOf = (a: Assignment) => rubrics.find((r) => r.assignmentId === a.id);

  // assignments the AI could be corrected on: a rubric, files for it to check, AI-assisted, enough work to sample
  const eligible = assignments.filter((a) => {
    const r = rubricOf(a);
    return a.courseId === id && !a.isExam && a.acceptsFiles !== false && !isManualGrading(a) && !!r && r.criteria.length > 0 && unitsOf(a).length >= MIN_SAMPLES;
  });
  const [pickedId, setPickedId] = useState("");
  const assignment = eligible.find((a) => a.id === pickedId) ?? eligible[0];
  const rubric = assignment ? rubricOf(assignment) : undefined;
  const units = useMemo(() => (assignment ? unitsOf(assignment) : []), [assignment, submissions, withdrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  const runsFor = assignment ? runs.filter((r) => r.assignmentId === assignment.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const draft = runsFor.find((r) => !r.completedAt);
  const lastDone = runsFor.find((r) => r.completedAt);

  const newDraft = (n: number): CalibrationRun | null => {
    if (!assignment || !rubric) return null;
    return { id: crypto.randomUUID(), assignmentId: assignment.id, createdAt: new Date().toISOString(), sampleIds: pickSample(units, rubric, n).map((u) => u.key), teacherLevels: {} };
  };
  // the first time an assignment is opened here, start a sample for it
  useEffect(() => {
    if (!assignment || !rubric || draft || lastDone || units.length < MIN_SAMPLES) return;
    const d = newDraft(DEFAULT_SAMPLES);
    if (d) saveRun(d);
  }, [assignment?.id, !!draft, !!lastDone, units.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !!assignment?.gradingFinalized;

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-sm text-[var(--text-secondary)]">
        {t("ไม่พบรายวิชานี้", "Course not found")} — <Link href="/teacher/courses" className="ml-1 text-[var(--accent)] hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
      </main>
    );
  }

  const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";
  const stepBadge = (n: number) => <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-solid)] text-xs font-bold text-[var(--accent-solid-text)]">{n}</span>;
  const primary = "h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const ghost = "inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <main className="w-full px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors" aria-label={t("รายวิชาทั้งหมด", "All courses")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">Calibration</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Calibration</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-3xl">{t("ตรวจงานตัวอย่างเองไม่กี่ชิ้น (โดยยังไม่เห็นคะแนน AI) แล้วดูว่า AI ตรวจต่างจากคุณตรงไหน ปรับความเข้มของ AI และดูว่า rubric ควรแก้อะไร", "Score a few samples yourself, without seeing the AI's marks, then see where the AI differs from you — tune how strict it is and see what the rubric itself may need.")}</p>
      </div>

      {eligible.length === 0 || !assignment || !rubric ? (
        <div className={`${card} p-6`}>
          <EmptyState
            iconColor="var(--accent-bright)"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>}
            title={t("ยังไม่มีงานให้ calibrate", "Nothing to calibrate yet")}
            description={t(`ต้องเป็นงานที่มี rubric รับไฟล์ ตรวจแบบให้ AI ช่วย และมีงานที่ส่งแล้วอย่างน้อย ${MIN_SAMPLES} ชิ้น`, `It needs an assignment with a rubric, files to check, AI-assisted grading and at least ${MIN_SAMPLES} submissions.`)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 1 — which assignment */}
          <section aria-labelledby="cal-1" className={`${card} p-6`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                {stepBadge(1)}
                <div>
                  <h2 id="cal-1" className="text-base font-bold text-[var(--text-primary)]">{t("เลือกงาน", "Pick the assignment")}</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {t(`${units.length} ชิ้นงาน · ${rubric.criteria.length} เกณฑ์`, `${units.length} ${units.length === 1 ? "item" : "items"} · ${rubric.criteria.length} criteria`)}
                    {" · "}
                    {rubric.aiOffsets && Object.values(rubric.aiOffsets).some((v) => v !== 0) ? t("AI ถูกปรับความเข้มแล้ว", "AI already tuned") : t("ยังไม่ได้ปรับ AI", "AI not tuned yet")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cal-asg" className="text-xs font-semibold text-[var(--text-muted)]">{t("งาน", "Assignment")}</label>
                <select id="cal-asg" value={assignment.id} onChange={(e) => setPickedId(e.target.value)} className="h-10 min-w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]">
                  {eligible.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* 2 — score the samples */}
          {draft && (
            <section aria-labelledby="cal-2" className={`${card} p-6`}>
              {(() => {
                const sample = draft.sampleIds.map((k) => units.find((u) => u.key === k)).filter((u): u is WorkUnit => !!u);
                const total = sample.length * rubric.criteria.length;
                const done = sample.reduce((n, u) => n + rubric.criteria.filter((c) => draft.teacherLevels[u.key]?.[c.id] !== undefined).length, 0);
                const setLevel = (key: string, cid: string, lvl: number) => saveRun({ ...draft, teacherLevels: { ...draft.teacherLevels, [key]: { ...(draft.teacherLevels[key] ?? {}), [cid]: lvl } } });
                const resample = (n: number) => saveRun({ ...draft, sampleIds: pickSample(units, rubric, n).map((u) => u.key), teacherLevels: {} });
                const swap = (key: string) => {
                  const here = aiLevelsFor(units.find((u) => u.key === key)!, rubric).score;
                  const alt = units.filter((u) => !draft.sampleIds.includes(u.key))
                    .map((u) => ({ u, d: Math.abs(aiLevelsFor(u, rubric).score - here) })).sort((a, b) => a.d - b.d)[0]?.u;
                  if (!alt) return;
                  const levels = { ...draft.teacherLevels }; delete levels[key];
                  saveRun({ ...draft, sampleIds: draft.sampleIds.map((k) => (k === key ? alt.key : k)), teacherLevels: levels });
                };
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        {stepBadge(2)}
                        <div>
                          <h2 id="cal-2" className="text-base font-bold text-[var(--text-primary)]">{t("ตรวจงานตัวอย่างเอง", "Score the samples yourself")}</h2>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("เลือกจากงานที่ AI ให้คะแนนสูง กลาง ต่ำ — คุณยังไม่เห็นคะแนนของ AI", "Picked across what the AI would rate high, middle and low — you do not see its marks yet")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="cal-n" className="text-xs font-semibold text-[var(--text-muted)]">{t("จำนวนตัวอย่าง", "Samples")}</label>
                          <select id="cal-n" value={draft.sampleIds.length} onChange={(e) => resample(Number(e.target.value))} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]">
                            {Array.from({ length: Math.min(MAX_SAMPLES, units.length) - MIN_SAMPLES + 1 }, (_, i) => MIN_SAMPLES + i).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <p aria-live="polite" data-testid="cal-progress" className="pt-5 text-sm tabular-nums text-[var(--text-secondary)]">{t(`ตรวจแล้ว ${done} จาก ${total}`, `${done} of ${total} scored`)}</p>
                      </div>
                    </div>

                    <ol className="flex flex-col gap-4">
                      {sample.map((u, si) => (
                        <li key={u.key} data-testid={`sample-${si}`} className="rounded-xl border border-[var(--border-subtle)] p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{t(`ตัวอย่างที่ ${si + 1}`, `Sample ${si + 1}`)} · {u.name}</p>
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {submissionAttachments(u.subs[0]).length > 0
                                  ? submissionAttachments(u.subs[0]).map((a) => a.name).join(", ")
                                  : t("ไม่มีไฟล์แนบในข้อมูลจำลอง", "No file attached in the demo data")}
                              </p>
                            </div>
                            <button type="button" onClick={() => swap(u.key)} className={ghost}>{t("สลับชิ้นอื่น", "Swap for another")}</button>
                          </div>
                          <ul className="flex flex-col gap-3">
                            {rubric.criteria.map((c) => {
                              const chosen = draft.teacherLevels[u.key]?.[c.id];
                              return (
                                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3">
                                  <CriterionName name={c.name} className="min-w-52 flex-1" />
                                  <div role="radiogroup" aria-label={t(`ระดับของ ${c.name} — ตัวอย่างที่ ${si + 1}`, `Level for ${c.name} — sample ${si + 1}`)} className="flex flex-wrap gap-1.5">
                                    {c.levels.map((lv, li) => (
                                      <button
                                        key={li} type="button" role="radio" aria-checked={chosen === li}
                                        title={lv.description}
                                        onClick={() => setLevel(u.key, c.id, li)}
                                        className={`h-9 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${chosen === li ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                                      >
                                        {lv.label} · {Math.round(c.maxPoints * levelShare(li, c.levels.length))}
                                      </button>
                                    ))}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-5 flex justify-end">
                      <button type="button" disabled={done < total || total === 0} onClick={() => saveRun({ ...draft, completedAt: new Date().toISOString() })} className={primary}>
                        {t("เทียบกับ AI", "Compare with the AI")}
                      </button>
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {/* 3 — compare and apply */}
          {!draft && lastDone && <ResultSection run={lastDone} units={units} assignment={assignment} rubric={rubric} locked={locked} courseId={id} onApply={(offsets) => { updateRubric(rubric.id, { aiOffsets: offsets }); saveRun({ ...lastDone, appliedAt: new Date().toISOString(), appliedOffsets: offsets }); }} onAgain={() => { const d = newDraft(lastDone.sampleIds.length); if (d) saveRun(d); }} graded={submissions.filter((s) => s.assignmentId === assignment.id && s.status === "graded")} />}

          {/* earlier calibrations of this course */}
          {runs.some((r) => r.completedAt && assignments.some((a) => a.id === r.assignmentId && a.courseId === id)) && (
            <section aria-labelledby="cal-hist" className={card}>
              <h2 id="cal-hist" className="px-6 pt-5 pb-3 text-base font-bold text-[var(--text-primary)]">{t("การ calibrate ที่ผ่านมา", "Earlier calibrations")}</h2>
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {runs.filter((r) => r.completedAt && assignments.some((a) => a.id === r.assignmentId && a.courseId === id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => (
                  <li key={r.id} data-testid={`history-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)]">{assignments.find((a) => a.id === r.assignmentId)?.name}</span>
                      <span className="ml-2 text-xs tabular-nums text-[var(--text-muted)]">{new Date(r.completedAt!).toLocaleDateString()} · {t(`${r.sampleIds.length} ตัวอย่าง`, `${r.sampleIds.length} samples`)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold ${r.appliedAt ? VERDICT_TONE.aligned : "border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-secondary)]"}`}>{r.appliedAt ? t("ใช้ค่านี้แล้ว", "Applied") : t("ยังไม่ได้ใช้", "Not applied")}</span>
                      <button type="button" onClick={() => removeRun(r.id)} className={ghost} aria-label={t("ลบรายการนี้", "Delete this run")}>{t("ลบ", "Delete")}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

// ── step 3 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ResultSection({ run, units, assignment, rubric, locked, courseId, graded, onApply, onAgain }: {
  run: CalibrationRun;
  units: WorkUnit[];
  assignment: Assignment;
  rubric: NonNullable<ReturnType<typeof useAssignments>["rubrics"][number]>;
  locked: boolean;
  courseId: string;
  graded: ReturnType<typeof useAssignments>["submissions"];
  onApply: (offsets: Record<string, number>) => void;
  onAgain: () => void;
}) {
  const { t } = useLanguage();
  // compared against the AI as it was when this run was scored: the saved correction at that time is not known here, so use the one
  // saved now minus whatever this run itself applied (a run that was applied must not be compared against its own correction)
  const baseOffsets = useMemo(() => {
    const cur = rubric.aiOffsets ?? {};
    if (!run.appliedOffsets) return cur;
    return Object.fromEntries(rubric.criteria.map((c) => [c.id, (cur[c.id] ?? 0) - (run.appliedOffsets![c.id] ?? 0)]));
  }, [rubric.aiOffsets, rubric.criteria, run.appliedOffsets]);
  const asScored = useMemo(() => ({ criteria: rubric.criteria, aiOffsets: baseOffsets }), [rubric.criteria, baseOffsets]);
  const cmp = useMemo(() => compare(run, units, asScored), [run, units, asScored]);
  const suggested = useMemo(() => suggestOffsets(cmp, baseOffsets), [cmp, baseOffsets]);
  const [offsets, setOffsets] = useState<Record<string, number>>(run.appliedOffsets ?? suggested);
  useEffect(() => { setOffsets(run.appliedOffsets ?? suggested); }, [run.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const changes = suggestRubricChanges(rubric, graded, cmp);

  const ghost = "inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primary = "h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const word = (c: CriterionComparison) => {
    const sign = `${c.bias > 0 ? "+" : ""}${c.bias.toFixed(1)}`;
    return c.verdict === "lenient" ? t(`AI ใจดีไป (${sign} ระดับ)`, `AI is generous (${sign} level)`)
      : c.verdict === "strict" ? t(`AI เข้มไป (${sign} ระดับ)`, `AI is strict (${sign} level)`)
      : c.verdict === "inconsistent" ? t("ไม่สม่ำเสมอ", "Inconsistent")
      : t("ตรงกัน", "Aligned");
  };
  const nameOf = (cid: string) => rubric.criteria.find((c) => c.id === cid)?.name ?? cid;
  const level = (c: { levels: unknown[] }, idx: number) => (c.levels.length - 1 - idx).toFixed(1);

  return (
    <section aria-labelledby="cal-3" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-solid)] text-xs font-bold text-[var(--accent-solid-text)]">3</span>
          <div>
            <h2 id="cal-3" className="text-base font-bold text-[var(--text-primary)]">{t("เทียบกับ AI แล้วปรับ", "Compare with the AI, then tune")}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t(`จาก ${run.sampleIds.length} ตัวอย่างที่คุณตรวจเอง`, `From the ${run.sampleIds.length} samples you scored`)}</p>
          </div>
        </div>
        <button type="button" onClick={onAgain} className={ghost}>{t("calibrate ใหม่", "Start a new calibration")}</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table data-testid="cal-table" className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[var(--bg-app)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <th scope="col" className="px-4 py-3">{t("เกณฑ์", "Criterion")}</th>
              <th scope="col" className="px-4 py-3">{t("คุณ", "You")}</th>
              <th scope="col" className="px-4 py-3">AI</th>
              <th scope="col" className="px-4 py-3">{t("ตรงกัน", "Same level")}</th>
              <th scope="col" className="px-4 py-3">{t("ผล", "Result")}</th>
              <th scope="col" className="px-4 py-3">{t("ปรับ AI", "AI correction")}<span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal">{t("+ เข้มขึ้น · − ใจดีขึ้น (ระดับ)", "+ stricter · − more generous (levels)")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cmp.map((c) => {
              const crit = rubric.criteria.find((x) => x.id === c.criterionId)!;
              const off = offsets[c.criterionId] ?? 0;
              return (
                <tr key={c.criterionId} data-testid={`cmp-${c.criterionId}`}>
                  <th scope="row" className="px-4 py-3 text-left align-top font-normal"><CriterionName name={crit.name} /></th>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`you-${c.criterionId}`}>{t("ระดับ", "Level")} {level(crit, c.teacherMean)}</td>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`ai-${c.criterionId}`}>{t("ระดับ", "Level")} {level(crit, c.aiMean)}</td>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`agree-${c.criterionId}`}>{Math.round(c.agreement * 100)}%</td>
                  <td className="px-4 py-3 align-top"><span data-testid={`verdict-${c.criterionId}`} className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${VERDICT_TONE[c.verdict]}`}>{word(c)}</span></td>
                  <td className="px-4 py-3 align-top">
                    <div role="group" aria-label={t(`ปรับความเข้ม ${crit.name}`, `Strictness for ${crit.name}`)} className="inline-flex items-center gap-1">
                      <button type="button" aria-label={t("เข้มน้อยลง", "Less strict")} disabled={off <= -MAX_OFFSET} onClick={() => setOffsets((o) => ({ ...o, [c.criterionId]: off - 1 }))} className={`${ghost} !h-8 !w-8 !px-0 justify-center`}>−</button>
                      <output data-testid={`offset-${c.criterionId}`} className="w-9 text-center text-sm font-semibold tabular-nums text-[var(--text-primary)]">{off > 0 ? `+${off}` : off}</output>
                      <button type="button" aria-label={t("เข้มขึ้น", "Stricter")} disabled={off >= MAX_OFFSET} onClick={() => setOffsets((o) => ({ ...o, [c.criterionId]: off + 1 }))} className={`${ghost} !h-8 !w-8 !px-0 justify-center`}>+</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p data-testid="cal-apply-note" className="text-sm text-[var(--text-secondary)] max-w-2xl">
          {run.appliedAt
            ? t("ใช้ค่านี้แล้ว — “ตรวจด้วย AI” ครั้งถัดไปของงานนี้จะใช้ค่าที่ปรับ", "Applied — the next “Grade with AI” on this assignment uses these corrections.")
            : locked
              ? t("ประกาศผลแล้ว จึงไม่มี “ตรวจด้วย AI” อีก — ใช้ค่านี้ไม่ได้", "Results are announced, so there is no more AI grading on this assignment — the values cannot be used.")
              : t("ค่านี้ยังไม่ถูกใช้ — กด “ใช้ค่านี้” เมื่อพอใจ", "Nothing is changed yet — press “Use these values” when you are happy with them.")}
        </p>
        <button type="button" disabled={locked || !!run.appliedAt} onClick={() => onApply(offsets)} className={primary}>{t("ใช้ค่านี้", "Use these values")}</button>
      </div>

      <h3 className="mt-8 mb-3 text-sm font-bold text-[var(--text-primary)]">{t("ข้อเสนอแนะเรื่อง rubric", "What the rubric itself may need")}</h3>
      {changes.length === 0 ? (
        <p data-testid="cal-no-suggestions" className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-secondary)]">{t("ยังไม่เห็นเกณฑ์ไหนที่ควรแก้จากข้อมูลตอนนี้", "Nothing in the data so far points at a criterion to change.")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {changes.map((s, i) => (
            <li key={i} data-testid={`suggest-${s.kind}-${s.criterionId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3">
              <div className="min-w-0">
                <CriterionName name={nameOf(s.criterionId)} />
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {s.kind === "ceiling" && t(`${Math.round(s.value * 100)}% ของงานได้ระดับสูงสุด — เกณฑ์นี้แทบไม่แยกคน ลองยกมาตรฐานหรือเพิ่มระดับ`, `${Math.round(s.value * 100)}% of the work reaches the top level — this criterion barely separates anyone. Raise the bar or add a level.`)}
                  {s.kind === "floor" && t(`ไม่มีใครถึงระดับสูงสุดเลย (${s.value} ชิ้น) — อาจสูงเกินไปหรือเขียนคำอธิบายแคบเกิน`, `Nobody reaches the top level (${s.value} items) — it may be out of reach or worded too tightly.`)}
                  {s.kind === "disagree" && t(`คุณกับ AI ต่างกันเฉลี่ย ${s.value.toFixed(1)} ระดับ — คำอธิบายระดับยังไม่ชัด ลองเขียนให้เห็นต่างกันมากขึ้น`, `You and the AI differ by ${s.value.toFixed(1)} levels on average — the level wording is not clear enough. Make the levels easier to tell apart.`)}
                  {s.kind === "heavy-flat" && t(`เกณฑ์นี้มีคะแนนครึ่งหนึ่งขึ้นไป แต่ ${Math.round(s.value * 100)}% ของงานอยู่ระดับเดียวกัน — ไม่ช่วยแยกคน ลองลดคะแนนหรือแยกเป็นหลายเกณฑ์`, `This criterion carries half the points or more, yet ${Math.round(s.value * 100)}% of the work sits on one level — it does not separate students. Lower its points or split it.`)}
                </p>
              </div>
              {locked
                ? <span className="text-xs text-[var(--text-muted)]">{t("ล็อกแล้ว — ประกาศผลแล้ว", "Locked once announced")}</span>
                : <Link href={`/teacher/courses/${courseId}/assignments/${assignment.id}/edit`} className={ghost}>{t("แก้ rubric", "Edit rubric")}</Link>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
