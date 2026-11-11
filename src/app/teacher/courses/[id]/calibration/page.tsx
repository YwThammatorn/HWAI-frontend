"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, isManualGrading, submissionAttachments, levelShare, gradingOpen, type Assignment } from "@/lib/assignments";
import { useNow } from "@/lib/clock";
import { useStudents, withdrawnIds } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { useCalibrations, pickSample, compare, suggestRubricChanges, aiLevelsFor, aiGradedUnits, workUnitsOf, type CalibrationRun, type WorkUnit, type CriterionComparison } from "@/lib/calibration";
import RubricEditModal from "@/components/RubricEditModal";
import CalibrationRegrade from "@/components/CalibrationRegrade";
import CriterionName from "@/components/CriterionName";
import EmptyState from "@/components/EmptyState";
import SubmissionViewer from "@/components/SubmissionViewer";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
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
  const { assignments, submissions, rubrics } = useAssignments();
  const { getStudentsByCourse } = useStudents();
  const { getGroupsByAssignment } = useStudentGroups();
  const { runs, saveRun, removeRun } = useCalibrations();
  const course = getCourse(id);
  const now = useNow();      // an assignment is offered only once grading has opened (15/10/2569)

  const roster = getStudentsByCourse(id);
  const withdrawn = withdrawnIds(roster);

  // the work of an assignment as units (a team is one unit) — and, for Calibration, only the units the AI has already graded (14/10/2569):
  // it compares the teacher with what the AI really gave, so there has to be something it gave
  const rubricOf = (a: Assignment) => rubrics.find((r) => r.assignmentId === a.id);
  const unitsOf = (a: Assignment): WorkUnit[] => {
    const r = rubricOf(a);
    const all = workUnitsOf(a, submissions, getGroupsByAssignment(a.id), withdrawn, t("ทีม", "Team"));
    return r ? aiGradedUnits(all, r) : [];
  };

  // assignments the AI could be corrected on: a rubric, files for it to check, AI-assisted, and enough work the AI has graded to sample
  const eligible = assignments.filter((a) => {
    const r = rubricOf(a);
    return a.courseId === id && !a.isExam && a.acceptsFiles !== false && !isManualGrading(a) && gradingOpen(a, now) && !!r && r.criteria.length > 0 && unitsOf(a).length >= MIN_SAMPLES;
  });
  const [pickedId, setPickedId] = useState("");
  // which sample is open in the grading workspace, and the zoom of the work next to it
  const [cur, setCur] = useState(0);
  const [zoom, setZoom] = useState(100);
  const assignment = eligible.find((a) => a.id === pickedId) ?? eligible[0];
  const rubric = assignment ? rubricOf(assignment) : undefined;
  const units = useMemo(() => (assignment ? unitsOf(assignment) : []), [assignment, submissions, withdrawn]); // eslint-disable-line react-hooks/exhaustive-deps

  const runsFor = assignment ? runs.filter((r) => r.assignmentId === assignment.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const draft = runsFor.find((r) => !r.completedAt);
  const lastDone = runsFor.find((r) => r.completedAt);

  const newDraft = (n: number): CalibrationRun | null => {
    if (!assignment || !rubric) return null;
    return { id: crypto.randomUUID(), assignmentId: assignment.id, createdAt: new Date().toISOString(), sampleIds: pickSample(units, rubric, n).map((u) => u.key), teacherLevels: {}, blind: true };
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
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("ปรับเทียบ AI", "Calibration")}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ปรับเทียบ AI", "Calibration")}</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-3xl">{t("ตรวจงานตัวอย่างเองไม่กี่ชิ้น แล้วดูว่า AI ตรวจต่างจากคุณตรงไหน และ rubric ควรแก้อะไรให้ AI กับคุณตรวจตรงกันขึ้น — Blind test เปิดไว้ให้ตั้งแต่แรก ซ่อนระดับที่ AI ให้และชื่อนักศึกษา (ผลเทียบเชื่อถือได้กว่า) ปิดได้ถ้าอยากเห็น", "Score a few samples yourself, then see where the AI differs from you and what the rubric may need so the two of you agree more. The Blind test starts on: it hides the AI's level and the students' names while you score (the comparison is then more trustworthy). Turn it off if you want to see them.")}</p>
      </div>

      {eligible.length === 0 || !assignment || !rubric ? (
        <div className={`${card} p-6`}>
          <EmptyState
          icon="sliders"
            title={t("ยังไม่มีงานให้ปรับเทียบ", "Nothing to calibrate yet")}
            description={t(`ต้องเป็นงานที่มี rubric รับไฟล์ ตรวจแบบให้ AI ช่วย และ AI ตรวจไปแล้วอย่างน้อย ${MIN_SAMPLES} ชิ้น — กด “ตรวจด้วย AI” ที่หน้าตรวจงานก่อน`, `It needs an assignment with a rubric, files to check, AI-assisted grading and at least ${MIN_SAMPLES} pieces the AI has already graded — press “Grade with AI” on the Grading page first.`)}
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
                    {t(`AI ตรวจแล้ว ${units.length} ชิ้น · ${rubric.criteria.length} เกณฑ์`, `${units.length} graded by the AI · ${rubric.criteria.length} ${rubric.criteria.length === 1 ? "criterion" : "criteria"}`)}
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
            <p data-testid="cal-ai-note" className="mt-4 max-w-3xl rounded-xl bg-[var(--bg-app)] px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("ในรายการนี้มีเฉพาะงานที่ผ่านการตรวจโดย AI มาแล้ว (อย่างน้อย 3 ชิ้น) — ระบบเอาผลที่ AI ตรวจไว้จริงมาเทียบกับระดับที่คุณให้ แล้วบอกว่าควรปรับ rubric อย่างไร แก้เสร็จแล้วสั่งให้ AI ตรวจใหม่ได้ (เฉพาะงานที่ยังไม่ประกาศผล)", "Only assignments the AI has already graded appear here (at least 3 pieces) — the system compares what the AI really gave with the levels you choose, then tells you how to adjust the rubric. After editing it you can have the AI grade again (only work whose results are not announced yet).")}
            </p>
          </section>

          {/* 2 — score the samples */}
          {draft && (
            <section aria-labelledby="cal-2" className={`${card} p-6`}>
              {(() => {
                const sample = draft.sampleIds.map((k) => units.find((u) => u.key === k)).filter((u): u is WorkUnit => !!u);
                const total = sample.length * rubric.criteria.length;
                const done = sample.reduce((n, u) => n + rubric.criteria.filter((c) => draft.teacherLevels[u.key]?.[c.id] !== undefined).length, 0);
                const sampleDone = sample.filter((u) => rubric.criteria.every((c) => draft.teacherLevels[u.key]?.[c.id] !== undefined)).length;
                const blind = !!draft.blind;
                // a mark given while the AI's level was on screen makes the whole run "not blind", and that stays true if the switch is turned on later
                const setLevel = (key: string, cid: string, lvl: number) => saveRun({ ...draft, sawAi: draft.sawAi || !blind, teacherLevels: { ...draft.teacherLevels, [key]: { ...(draft.teacherLevels[key] ?? {}), [cid]: lvl } } });
                const resample = (n: number) => { setCur(0); saveRun({ ...draft, sampleIds: pickSample(units, rubric, n).map((u) => u.key), teacherLevels: {}, sawAi: false }); };
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
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {blind
                              ? t("เลือกจากงานที่ AI ให้คะแนนสูง กลาง ต่ำ — ซ่อนคะแนนของ AI และชื่อนักศึกษาไว้", "Picked across what the AI rated high, middle and low — its marks and the students' names are hidden")
                              : t("เลือกจากงานที่ AI ให้คะแนนสูง กลาง ต่ำ — ระดับที่ AI ให้แสดงอยู่ข้างการ์ดระดับ (ตรวจเร็วขึ้น แต่คะแนนของคุณอาจเอนตาม AI)", "Picked across what the AI would rate high, middle and low — its level is marked on each criterion (quicker, but it can sway your marks)")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <span id="cal-blind-label" className="text-xs font-semibold text-[var(--text-muted)]">{t("Blind test", "Blind test")}</span>
                          <button
                            type="button" role="switch" aria-checked={blind} aria-labelledby="cal-blind-label"
                            onClick={() => saveRun({ ...draft, blind: !blind })}
                            className={`relative h-9 w-16 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${blind ? "border-[var(--accent)] bg-[var(--accent-solid)]" : "border-[var(--border)] bg-[var(--bg-surface)]"}`}
                          >
                            <span aria-hidden="true" className={`absolute top-1 h-6 w-6 rounded-full transition-all ${blind ? "left-[34px] bg-[var(--accent-solid-text)]" : "left-1 bg-[var(--text-muted)]"}`} />
                            <span className="sr-only">{blind ? t("เปิด", "On") : t("ปิด", "Off")}</span>
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label htmlFor="cal-n" className="text-xs font-semibold text-[var(--text-muted)]">{t("จำนวนตัวอย่าง", "Samples")}</label>
                          <select id="cal-n" value={draft.sampleIds.length} onChange={(e) => resample(Number(e.target.value))} className="h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]">
                            {Array.from({ length: Math.min(MAX_SAMPLES, units.length) - MIN_SAMPLES + 1 }, (_, i) => MIN_SAMPLES + i).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <p aria-live="polite" data-testid="cal-progress" className="pt-4 text-sm tabular-nums text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{t(`ให้ระดับครบแล้ว ${sampleDone} จาก ${sample.length} ตัวอย่าง`, `${sampleDone} of ${sample.length} samples fully scored`)}</span>
                          <span className="block text-xs text-[var(--text-muted)]">{t(`(${done} จาก ${total} เกณฑ์)`, `(${done} of ${total} criteria)`)}</span>
                        </p>
                      </div>
                    </div>

                    {(() => {
                      // the same shape as the Grade screen: the work on the left, the marking on the right —
                      // but the marks are picked by clicking a level of the rubric, and the AI's are hidden
                      const ci = Math.min(cur, sample.length - 1);
                      const u = sample[ci];
                      if (!u) return null;
                      const attachments = submissionAttachments(u.subs[0]);
                      const scoredHere = rubric.criteria.filter((c) => draft.teacherLevels[u.key]?.[c.id] !== undefined).length;
                      const complete = (x: WorkUnit) => rubric.criteria.every((c) => draft.teacherLevels[x.key]?.[c.id] !== undefined);
                      return (
                        <div className="grid overflow-hidden rounded-xl border border-[var(--border-subtle)] lg:h-[min(720px,calc(100vh-13rem))] lg:grid-cols-[minmax(0,1fr)_400px]">
                          {/* left — the work */}
                          <div className="flex min-h-[420px] min-w-0 flex-col bg-[var(--surface)] lg:min-h-0">
                            <ol aria-label={t("รายการตัวอย่าง", "Sample list")} className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5">
                              {sample.map((x, si) => (
                                <li key={x.key} data-testid={`sample-${si}`} data-sample-name={blind ? undefined : x.name} className="shrink-0">
                                  <button
                                    type="button" onClick={() => setCur(si)} aria-current={si === ci ? "true" : undefined}
                                    aria-label={t(`ตัวอย่างที่ ${si + 1}`, `Sample ${si + 1}`)}
                                    className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${si === ci ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                                  >
                                    {si + 1}
                                    {complete(x) && <Icon name="check" size="sm" />}
                                  </button>
                                </li>
                              ))}
                            </ol>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{t("มุมมอง", "View")}</span>
                                <button type="button" aria-label={t("ซูมออก", "Zoom out")} onClick={() => setZoom((z) => Math.max(25, z - 25))} className={`${ghost} !h-7 !w-7 !px-0 justify-center`}>−</button>
                                <span className="w-12 text-center text-sm font-medium tabular-nums text-[var(--text-primary)]">{zoom}%</span>
                                <button type="button" aria-label={t("ซูมเข้า", "Zoom in")} onClick={() => setZoom((z) => Math.min(200, z + 25))} className={`${ghost} !h-7 !w-7 !px-0 justify-center`}>+</button>
                              </div>
                              <button type="button" onClick={() => swap(u.key)} className={ghost}>{t("สลับชิ้นอื่น", "Swap for another")}</button>
                            </div>
                            <SubmissionViewer
                              key={u.key}
                              attachments={attachments}
                              zoom={zoom}
                              caption={blind ? undefined : u.name}
                              anonymous={blind}
                              empty={
                                <div className="flex flex-1 items-center justify-center p-8 text-center">
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{blind ? t(`ตัวอย่างที่ ${ci + 1}`, `Sample ${ci + 1}`) : u.name}</p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">{t("ไม่มีไฟล์แนบในข้อมูลจำลอง", "No file attached in the demo data")}</p>
                                  </div>
                                </div>
                              }
                            />
                          </div>

                          {/* right — the marking */}
                          <div className="flex min-h-0 flex-col border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:border-l lg:border-t-0">
                            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
                              <h3 className="text-base font-bold text-[var(--text-primary)]">{t("ให้คะแนนงานนี้", "Score this work")}</h3>
                              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {blind ? t(`ตัวอย่างที่ ${ci + 1} จาก ${sample.length}`, `Sample ${ci + 1} of ${sample.length}`) : t(`ตัวอย่างที่ ${ci + 1} จาก ${sample.length} · ${u.name}`, `Sample ${ci + 1} of ${sample.length} · ${u.name}`)}
                              </p>
                              <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {blind
                                  ? t("คลิกระดับที่ตรงกับงาน — ยังไม่เห็นคะแนนของ AI", "Click the level that fits the work — the AI's marks stay hidden")
                                  : t("คลิกระดับที่ตรงกับงาน — ป้าย AI คือระดับที่ AI ให้", "Click the level that fits the work — the AI tag is the level it gave")}
                              </p>
                            </div>
                            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                              {rubric.criteria.map((c) => {
                                const chosen = draft.teacherLevels[u.key]?.[c.id];
                                const aiLevel = blind ? undefined : aiLevelsFor(u, rubric).levels[c.id];
                                return (
                                  <li key={c.id} className="rounded-xl border border-[var(--border-subtle)] p-4">
                                    <CriterionName name={c.name} />
                                    <div role="radiogroup" aria-label={t(`ระดับของ ${c.name} — ตัวอย่างที่ ${ci + 1}`, `Level for ${c.name} — sample ${ci + 1}`)} className="mt-3 flex flex-col gap-1.5">
                                      {c.levels.map((lv, li) => (
                                        <button
                                          key={li} type="button" role="radio" aria-checked={chosen === li}
                                          onClick={() => setLevel(u.key, c.id, li)}
                                          className={`rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${chosen === li ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border)] hover:bg-[var(--bg-subtle)]"}`}
                                        >
                                          <span className="flex items-center gap-2 text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                                            {lv.label} · {Math.round(c.maxPoints * levelShare(li, c.levels.length))}
                                            {aiLevel === li && <span data-testid={`mark-ai-${c.id}`} className="rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--s-info-text)]">AI</span>}
                                          </span>
                                          {lv.description && <span className="mt-0.5 block text-xs leading-snug text-[var(--text-secondary)]">{lv.description}</span>}
                                        </button>
                                      ))}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-3">
                              <button type="button" disabled={ci === 0} onClick={() => setCur(ci - 1)} className={ghost}>{t("ก่อนหน้า", "Previous")}</button>
                              <span className="text-xs tabular-nums text-[var(--text-muted)]">{t(`${scoredHere} จาก ${rubric.criteria.length} เกณฑ์`, `${scoredHere} of ${rubric.criteria.length} criteria`)}</span>
                              <button type="button" disabled={ci >= sample.length - 1} onClick={() => setCur(ci + 1)} className={ghost}>{t("ถัดไป", "Next")}</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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

          {/* 3 — compare */}
          {!draft && lastDone && <ResultSection run={lastDone} units={units} assignment={assignment} rubric={rubric} locked={locked} courseId={id} onAgain={() => { const d = newDraft(lastDone.sampleIds.length); if (d) saveRun(d); }} graded={submissions.filter((s) => s.assignmentId === assignment.id && s.status === "graded")} />}

          {/* earlier calibrations of this course */}
          {runs.some((r) => r.completedAt && assignments.some((a) => a.id === r.assignmentId && a.courseId === id)) && (
            <section aria-labelledby="cal-hist" className={card}>
              <h2 id="cal-hist" className="px-6 pt-5 pb-3 text-base font-bold text-[var(--text-primary)]">{t("การปรับเทียบที่ผ่านมา", "Earlier calibrations")}</h2>
              <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                {runs.filter((r) => r.completedAt && assignments.some((a) => a.id === r.assignmentId && a.courseId === id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => (
                  <li key={r.id} data-testid={`history-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-[var(--text-primary)]">{assignments.find((a) => a.id === r.assignmentId)?.name}</span>
                      <span className="ml-2 text-xs tabular-nums text-[var(--text-muted)]">{new Date(r.completedAt!).toLocaleDateString()} · {t(`${r.sampleIds.length} ตัวอย่าง`, `${r.sampleIds.length} samples`)}{r.sawAi && ` · ${t("เห็นผล AI ตอนตรวจ", "AI's level was visible")}`}</span>
                    </span>
                    <span className="flex items-center gap-3">
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

function ResultSection({ run, units, assignment, rubric, locked, courseId, graded, onAgain }: {
  run: CalibrationRun;
  units: WorkUnit[];
  assignment: Assignment;
  rubric: NonNullable<ReturnType<typeof useAssignments>["rubrics"][number]>;
  locked: boolean;
  courseId: string;
  graded: ReturnType<typeof useAssignments>["submissions"];
  onAgain: () => void;
}) {
  const { t } = useLanguage();
  // compared with the marks the AI really stored (14/10/2569)
  const cmp = useMemo(() => compare(run, units, rubric), [run, units, rubric]);
  const [editOpen, setEditOpen] = useState(false);
  const [afterEdit, setAfterEdit] = useState(false);
  const changes = suggestRubricChanges(rubric, graded, cmp);
  const suggestionText = (s: (typeof changes)[number]) =>
    s.kind === "ceiling" ? t(`${Math.round(s.value * 100)}% ของงานได้ระดับสูงสุด — เกณฑ์นี้แทบไม่แยกคน ลองยกมาตรฐานหรือเพิ่มระดับ`, `${Math.round(s.value * 100)}% of the work reaches the top level — this criterion barely separates anyone. Raise the bar or add a level.`)
    : s.kind === "floor" ? t(`ไม่มีใครถึงระดับสูงสุดเลย (${s.value} ชิ้น) — อาจสูงเกินไปหรือเขียนคำอธิบายแคบเกิน`, `Nobody reaches the top level (${s.value} items) — it may be out of reach or worded too tightly.`)
    : s.kind === "disagree" ? t(`คุณกับ AI ต่างกันเฉลี่ย ${s.value.toFixed(1)} ระดับ — คำอธิบายระดับยังไม่ชัด ลองเขียนให้เห็นต่างกันมากขึ้น`, `You and the AI differ by ${s.value.toFixed(1)} levels on average — the level wording is not clear enough. Make the levels easier to tell apart.`)
    : t(`เกณฑ์นี้มีคะแนนครึ่งหนึ่งขึ้นไป แต่ ${Math.round(s.value * 100)}% ของงานอยู่ระดับเดียวกัน — ไม่ช่วยแยกคน ลองลดคะแนนหรือแยกเป็นหลายเกณฑ์`, `This criterion carries half the points or more, yet ${Math.round(s.value * 100)}% of the work sits on one level — it does not separate students. Lower its points or split it.`);
  const flagged = Object.fromEntries(changes.map((c) => [c.criterionId, suggestionText(c)]));

  const ghost = "inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
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
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-solid)] text-xs font-bold text-[var(--accent-solid-text)]">2</span>
          <div>
            <h2 id="cal-3" className="text-base font-bold text-[var(--text-primary)]">{t("เทียบกับ AI", "Compare with the AI")}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t(`จาก ${run.sampleIds.length} ตัวอย่างที่คุณตรวจเอง`, `From the ${run.sampleIds.length} samples you scored`)}</p>
          </div>
        </div>
        <button type="button" onClick={onAgain} className={ghost}>{t("ปรับเทียบใหม่", "Start a new calibration")}</button>
      </div>
      {run.sawAi && (
        <p data-testid="cal-not-blind" className="mb-4 rounded-xl border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-4 py-3 text-sm text-[var(--s-info-text)]">
          {t("รอบนี้ไม่ใช่ blind — คุณเห็นระดับที่ AI ให้ระหว่างตรวจ ความตรงกันจึงอาจสูงกว่าความจริง ถ้าจะใช้ผลนี้แก้ rubric ให้เชื่อถือได้ ควรปรับเทียบใหม่โดยเปิด Blind test", "This round was not blind — you could see the AI's level while scoring, so agreement may read higher than it really is. To act on it with confidence, run it again with the Blind test on.")}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table data-testid="cal-table" className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[var(--bg-app)] text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <th scope="col" className="px-4 py-3">{t("เกณฑ์", "Criterion")}</th>
              <th scope="col" className="px-4 py-3">{t("คุณ", "You")}</th>
              <th scope="col" className="px-4 py-3">AI</th>
              <th scope="col" className="px-4 py-3">{t("ตรงกัน", "Same level")}</th>
              <th scope="col" className="px-4 py-3">{t("ผล", "Result")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cmp.map((c) => {
              const crit = rubric.criteria.find((x) => x.id === c.criterionId)!;
              return (
                <tr key={c.criterionId} data-testid={`cmp-${c.criterionId}`}>
                  <th scope="row" className="px-4 py-3 text-left align-top font-normal"><CriterionName name={crit.name} /></th>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`you-${c.criterionId}`}>{t("ระดับ", "Level")} {level(crit, c.teacherMean)}</td>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`ai-${c.criterionId}`}>{t("ระดับ", "Level")} {level(crit, c.aiMean)}</td>
                  <td className="px-4 py-3 align-top tabular-nums" data-testid={`agree-${c.criterionId}`}>{Math.round(c.agreement * 100)}%</td>
                  <td className="px-4 py-3 align-top"><span data-testid={`verdict-${c.criterionId}`} className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${VERDICT_TONE[c.verdict]}`}>{word(c)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{suggestionText(s)}</p>
              </div>
              {locked
                ? <span className="text-xs text-[var(--text-muted)]">{t("ล็อกแล้ว — ประกาศผลแล้ว", "Locked once announced")}</span>
                : <button type="button" data-testid={`edit-rubric-${s.criterionId}`} onClick={() => setEditOpen(true)} className={ghost}>{t("แก้ rubric", "Edit rubric")}</button>}
            </li>
          ))}
        </ul>
      )}

      {!locked && <CalibrationRegrade assignment={assignment} rubric={rubric} courseId={courseId} emphasise={afterEdit} />}

      <RubricEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        assignment={assignment}
        rubric={rubric}
        courseId={courseId}
        flagged={flagged}
        onSaved={() => setAfterEdit(true)}
      />
    </section>
  );
}
