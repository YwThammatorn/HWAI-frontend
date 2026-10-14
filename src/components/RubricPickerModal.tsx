"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import CriterionName from "@/components/CriterionName";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, type CriterionLevel, type RubricCriterion } from "@/lib/assignments";
import { useRubricLibrary } from "@/lib/rubricLibrary";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { rubricCandidates, criterionStats, proposeReplacement, type RubricCandidate, type CandidateSource } from "@/lib/rubricHistory";
import { toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";
import { termHeading } from "@/lib/academicTerm";

/** What the picker hands back: one entry per criterion the teacher wants. `levels` absent = the editor's own default levels. */
export interface PickedCriterion { name: string; description: string; points: number; levels?: CriterionLevel[]; cloIds: string[] }

type Decision = { take: boolean; action: "drop" | "own" | "ai"; ownName: string; round: number; aiBrief: string };

/**
 * "Use a rubric from before" (12/10/2569). Step 1: choose where to take it from — the same subject in other terms / years
 * (last year first), any of the teacher's courses, or the subject's library — and see it with how it did. Step 2: criterion by
 * criterion Take or Skip; a skipped criterion can simply go, be replaced by one the teacher names, or be replaced by one the
 * (stand-in) AI proposes, and "Ask again" gives another. Finish by replacing the current criteria or adding to them.
 */
export default function RubricPickerModal({ open, onClose, courseId, assignmentId, hasCriteria, clos, brief, onApply }: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  /** the assignment being edited, never offered as its own source */
  assignmentId?: string;
  /** the editor already holds criteria → offer "add to current" next to "replace" */
  hasCriteria: boolean;
  /** this course's CLOs: a tag is kept only when its CLO exists here */
  clos?: { id: string }[];
  /** name + description of the assignment, to steer the AI's replacement */
  brief: string;
  onApply: (criteria: PickedCriterion[], mode: "replace" | "add") => void;
}) {
  const { t, lang } = useLanguage();
  const { courses } = useCourses();
  const { assignments, rubrics, submissions } = useAssignments();
  const { entries } = useRubricLibrary();
  const myCourseIds = useMyCourseIds();

  const [tab, setTab] = useState<CandidateSource>("subject");
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<"choose" | "criteria">("choose");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [mode, setMode] = useState<"replace" | "add">("replace");

  useEffect(() => {
    if (open) { setTab("subject"); setSelected(null); setStep("choose"); setDecisions({}); setMode("replace"); }
  }, [open]);

  const all = useMemo(
    () => rubricCandidates({ courseId, courses, assignments, rubrics, submissions, library: entries, excludeAssignmentId: assignmentId, myCourseIds }),
    [courseId, courses, assignments, rubrics, submissions, entries, assignmentId, myCourseIds],
  );
  const inTab = (c: RubricCandidate, which: CandidateSource) => (which === "library" ? c.source === "library" : which === "subject" ? c.source === "subject" : c.source === "subject" || c.source === "mine");
  const counts = { subject: all.filter((c) => inTab(c, "subject")).length, mine: all.filter((c) => inTab(c, "mine")).length, library: all.filter((c) => inTab(c, "library")).length };
  const list = all.filter((c) => inTab(c, tab));
  const chosen = all.find((c) => c.key === selected) ?? null;

  const stats = useMemo(() => {
    if (!chosen?.assignmentId) return null;
    const rb = rubrics.find((r) => r.assignmentId === chosen.assignmentId);
    return rb ? criterionStats(rb, submissions.filter((s) => s.assignmentId === chosen.assignmentId)) : null;
  }, [chosen, rubrics, submissions]);

  const termText = (c: RubricCandidate) =>
    [c.courseName, c.academicYear && c.term ? termHeading(c.academicYear, c.term, t) : undefined, c.sectionNumber ? t(`กลุ่ม ${c.sectionNumber}`, `Sec ${c.sectionNumber}`) : undefined].filter(Boolean).join(" · ");

  function choose(c: RubricCandidate) {
    setSelected(c.key);
    setDecisions(Object.fromEntries(c.criteria.map((cr) => [cr.id, { take: true, action: "drop", ownName: "", round: 0, aiBrief: "" } as Decision])));
  }
  const decision = (id: string): Decision => decisions[id] ?? { take: true, action: "drop", ownName: "", round: 0, aiBrief: "" };
  const patch = (id: string, d: Partial<Decision>) => setDecisions((prev) => ({ ...prev, [id]: { ...decision(id), ...d } }));

  // what each skipped criterion would be replaced by (AI choice depends on the criteria already taken)
  const takenNames = chosen ? chosen.criteria.filter((c) => decision(c.id).take).map((c) => c.name) : [];
  const aiFor = (c: RubricCriterion) =>
    proposeReplacement({ brief: `${decision(c.id).aiBrief}\n${brief}\n${chosen?.title ?? ""}\n${c.name}`, userBrief: decision(c.id).aiBrief, skippedName: c.name, takenNames, round: decision(c.id).round, points: c.maxPoints, lang: lang === "en" ? "en" : "th" });

  const result: PickedCriterion[] = chosen ? chosen.criteria.flatMap((c): PickedCriterion[] => {
    const d = decision(c.id);
    if (d.take) return [{ name: c.name, description: c.description, points: c.maxPoints, levels: c.levels.map((l) => ({ ...l })), cloIds: (c.cloIds ?? []).filter((id) => !clos || clos.some((x) => x.id === id)) }];
    if (d.action === "own") return d.ownName.trim() ? [{ name: d.ownName.trim(), description: "", points: c.maxPoints, cloIds: [] }] : [];
    if (d.action === "ai") { const r = aiFor(c); return r ? [{ name: r.name, description: r.description, points: r.maxPoints, levels: r.levels.map((l) => ({ ...l })), cloIds: [] }] : []; }
    return [];
  }) : [];
  const ownMissing = chosen ? chosen.criteria.some((c) => !decision(c.id).take && decision(c.id).action === "own" && !decision(c.id).ownName.trim()) : false;
  const totalPts = result.reduce((n, c) => n + c.points, 0);

  const tabBtn = (key: CandidateSource, label: string) => (
    <button
      key={key} type="button" role="tab" aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${tab === key ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] border border-[var(--accent)]" : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
    >
      {label} <span className="tabular-nums text-[var(--text-muted)]">{counts[key]}</span>
    </button>
  );

  const secondary = "h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primary = "h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("ใช้ rubric จากงานก่อนหน้า", "Use a rubric from before")}
      description={step === "choose" ? t("เลือก rubric ที่เคยใช้ — ปีที่แล้วหรือปีอื่นก็ได้", "Pick a rubric you used earlier — last year or any other") : t("เลือกว่าจะเอาหรือไม่เอาแต่ละเกณฑ์", "Choose which criteria to take")}
      footer={
        step === "choose" ? (
          <>
            <button type="button" onClick={onClose} className={secondary}>{t("ยกเลิก", "Cancel")}</button>
            <button type="button" disabled={!chosen} onClick={() => setStep("criteria")} className={primary}>{t("ถัดไป: เลือกเกณฑ์", "Next: choose criteria")}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep("choose")} className={secondary}>{t("ย้อนกลับ", "Back")}</button>
            <button type="button" disabled={result.length === 0 || ownMissing} onClick={() => { onApply(result, hasCriteria ? mode : "replace"); onClose(); }} className={primary}>
              {t(`ใช้ ${result.length} เกณฑ์ (${totalPts} คะแนน)`, `Use ${result.length} ${result.length === 1 ? "criterion" : "criteria"} (${totalPts} pts)`)}
            </button>
          </>
        )
      }
    >
      {step === "choose" && (
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label={t("แหล่งที่มา", "Where from")} className="flex flex-wrap gap-1.5">
            {tabBtn("subject", t("วิชาเดียวกัน", "Same subject"))}
            {tabBtn("mine", t("ทุกวิชาของฉัน", "All my courses"))}
            {tabBtn("library", t("คลัง", "Library"))}
          </div>
          <div data-testid="picker-legend" className="rounded-xl bg-[var(--bg-app)] px-4 py-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            <p className="mb-1 font-semibold text-[var(--text-primary)]">{t("ป้ายและตัวเลขในรายการนี้", "What the tags and numbers below mean")}</p>
            <ul className="flex flex-col gap-1">
              <li><span className="mr-1.5 rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 py-0.5 font-semibold text-[var(--s-info-text)]">{t("ปีที่แล้ว", "Last year")}</span>{t("rubric ของวิชานี้ในปีการศึกษาก่อนหน้า", "this subject's rubric from the previous academic year")}</li>
              <li><span className="mr-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-semibold text-[var(--text-secondary)]">{t("คลัง", "Library")}</span>{t("rubric ที่คุณกด “บันทึกลงคลัง” ไว้ — ไม่ผูกกับงานใด จึงไม่มีผลคะแนน", "a rubric you saved with “Save to library” — it belongs to no assignment, so it has no results")}</li>
              <li><span className="mr-1.5 font-semibold tabular-nums text-[var(--text-primary)]">{t("3 เกณฑ์ · 15 คะแนน", "3 criteria · 15 pts")}</span>{t("จำนวนเกณฑ์ และคะแนนเต็มรวมของ rubric", "how many criteria, and the rubric's total points")}</li>
              <li><span className="mr-1.5 font-semibold tabular-nums text-[var(--text-primary)]">{t("เฉลี่ย 66% (36)", "avg 66% (36)")}</span>{t("คะแนนเฉลี่ยที่นักศึกษาได้ในงานนั้น (คะแนนที่ได้ ÷ คะแนนเต็ม) นับจากงานที่ตรวจแล้ว 36 ชิ้น", "the class's average on that assignment (points earned ÷ points possible), from the 36 pieces of work that were graded")}</li>
            </ul>
          </div>

          {list.length === 0 ? (
            <p data-testid="picker-empty" className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              {tab === "library"
                ? t("ยังไม่มี rubric ในคลัง — กด “บันทึกลงคลัง” ที่หน้าสร้างงานเพื่อเก็บไว้ใช้ซ้ำ", "Nothing in the library yet — press “Save to library” on an assignment's rubric to keep it for reuse.")
                : t("ยังไม่มีงานเก่าที่มี rubric ให้ยกมา", "No earlier assignment with a rubric to take from.")}
            </p>
          ) : (
            <ul role="radiogroup" aria-label={t("rubric ที่เลือกได้", "Rubrics to choose from")} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {list.map((c) => {
                const on = c.key === selected;
                return (
                  <li key={c.key}>
                    <button
                      type="button" role="radio" aria-checked={on}
                      onClick={() => choose(c)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${on ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{c.title}</span>
                        {c.lastYear && <span className="rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--s-info-text)]">{t("ปีที่แล้ว", "Last year")}</span>}
                        {c.source === "library" && <span className="rounded-md border border-[var(--border)] bg-[var(--bg-app)] px-1.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">{t("คลัง", "Library")}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{termText(c) || t("บันทึกไว้ในคลัง", "Saved in the library")}</span>
                      <span className="mt-1 block text-xs tabular-nums text-[var(--text-muted)]">
                        {t(`${c.criteria.length} เกณฑ์ · ${c.maxPoints} คะแนน`, `${c.criteria.length} criteria · ${c.maxPoints} pts`)}
                        {c.avgPct !== null && ` · ${t("เฉลี่ย", "avg")} ${Math.round(c.avgPct)}% (${c.gradedCount})`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {chosen && (
            <div data-testid="picker-preview" className="rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("เกณฑ์ใน rubric นี้", "Criteria in this rubric")}</p>
              <p data-testid="picker-preview-help" className="mb-3 mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {stats
                  ? t("ตัวเลข % สี คือคะแนนเฉลี่ยที่นักศึกษาได้ในแต่ละเกณฑ์ตอนที่ใช้ rubric นี้ (คะแนนที่ได้ ÷ คะแนนเต็มของเกณฑ์ จากงานที่ตรวจแล้ว) — เขียว 80% ขึ้นไป · น้ำเงิน 60–79% · แดงต่ำกว่า 60% ใช้ดูว่าเกณฑ์ไหนง่ายหรือยากไป ส่วนตัวเลขหลัง “เต็ม” คือคะแนนเต็มของเกณฑ์นั้น", "The coloured % is how the class did on each criterion when this rubric was used (points earned ÷ the criterion's points, over graded work) — green 80% and up · blue 60–79% · red under 60%. Use it to spot criteria that were too easy or too hard. “Max” is the criterion's own total.")
                  : t("rubric นี้ยังไม่มีผลตรวจให้ดู จึงไม่มีตัวเลขเฉลี่ย — ตัวเลขหลัง “เต็ม” คือคะแนนเต็มของแต่ละเกณฑ์", "There are no graded results for this rubric, so no averages are shown. “Max” is each criterion's own total.")}
              </p>
              <ul className="flex flex-col gap-2.5">
                {chosen.criteria.map((c) => {
                  const st = stats?.[c.id];
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <CriterionName name={c.name} />
                      <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-[var(--text-muted)]">
                        {st && st.avgPct !== null && (
                          <span title={t("คะแนนเฉลี่ยของนักศึกษาในเกณฑ์นี้ตอนนั้น", "Class average on this criterion then")} aria-label={t(`คะแนนเฉลี่ยของนักศึกษา ${Math.round(st.avgPct)}%`, `Class average ${Math.round(st.avgPct)}%`)} className={`inline-flex h-6 items-center rounded-md px-2 font-semibold ${SCORE_TONE_CLASSES[toneForPct(st.avgPct)]}`}>{Math.round(st.avgPct)}%</span>
                        )}
                        {t("เต็ม", "max")} {c.maxPoints}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === "criteria" && chosen && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("จาก", "From")} <span className="font-semibold text-[var(--text-primary)]">{chosen.title}</span>{termText(chosen) ? ` · ${termText(chosen)}` : ""}
          </p>
          <ul className="flex flex-col gap-3">
            {chosen.criteria.map((c) => {
              const d = decision(c.id);
              const ai = !d.take && d.action === "ai" ? aiFor(c) : null;
              return (
                <li key={c.id} data-testid={`pick-row-${c.id}`} className="rounded-xl border border-[var(--border-subtle)] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <CriterionName name={c.name} />
                    <div role="radiogroup" aria-label={t(`เอาหรือไม่เอา ${c.name}`, `Take or skip ${c.name}`)} className="inline-flex shrink-0 gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
                      {([true, false] as const).map((take) => (
                        <button
                          key={String(take)} type="button" role="radio" aria-checked={d.take === take}
                          onClick={() => patch(c.id, { take })}
                          className={`h-7 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${d.take === take ? (take ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]" : "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border border-[var(--s-err-bd)]") : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                        >
                          {take ? t("เอา", "Take") : t("ไม่เอา", "Skip")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!d.take && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold text-[var(--text-muted)]">{t(`ไม่เอาเกณฑ์นี้ — ${c.maxPoints} คะแนนจะ…`, `Skipping this — its ${c.maxPoints} points will…`)}</p>
                      <div role="radiogroup" aria-label={t("แทนที่ด้วย", "Replace with")} className="flex flex-wrap gap-2">
                        {([
                          ["drop", t("ตัดทิ้ง", "Be dropped")],
                          ["own", t("ใช้เกณฑ์ที่ฉันตั้งเอง", "Go to a criterion I name")],
                          ["ai", t("ให้ AI เสนอเกณฑ์ใหม่", "Go to one the AI proposes")],
                        ] as const).map(([key, label]) => (
                          <button
                            key={key} type="button" role="radio" aria-checked={d.action === key}
                            onClick={() => patch(c.id, { action: key })}
                            className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${d.action === key ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {d.action === "own" && (
                        <input
                          value={d.ownName}
                          onChange={(e) => patch(c.id, { ownName: e.target.value })}
                          aria-label={t(`ชื่อเกณฑ์ใหม่แทน ${c.name}`, `Name of the criterion that replaces ${c.name}`)}
                          placeholder={t("ชื่อเกณฑ์ใหม่ เช่น การนำเสนอ", "New criterion name, e.g. Presentation")}
                          className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                        />
                      )}
                      {d.action === "ai" && (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-[var(--text-muted)]">{t("บอก AI ว่าอยากได้เกณฑ์แบบไหน (ไม่บังคับ)", "Tell the AI what you want instead (optional)")}</span>
                          <input
                            value={d.aiBrief}
                            onChange={(e) => patch(c.id, { aiBrief: e.target.value, round: 0 })}
                            aria-label={t(`บรีฟให้ AI สำหรับเกณฑ์ที่แทน ${c.name}`, `Brief for the AI for the criterion that replaces ${c.name}`)}
                            placeholder={t("เช่น วัดการนำเสนอและการทำงานเป็นทีม", "e.g. should judge the presentation and teamwork")}
                            className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                          />
                        </label>
                      )}
                      {d.action === "ai" && (
                        <div data-testid={`ai-proposal-${c.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3">
                          {ai ? <CriterionName name={ai.name} /> : <p className="text-sm text-[var(--text-secondary)]">{t("ไม่มีข้อเสนออื่นแล้ว", "No other suggestion left")}</p>}
                          <button type="button" onClick={() => patch(c.id, { round: d.round + 1 })} className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]">
                            {t("เสนออันอื่น", "Ask again")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {hasCriteria && (
            <div role="radiogroup" aria-label={t("ใส่ลงใน rubric ปัจจุบัน", "Put into the current rubric")} className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-[var(--text-muted)]">{t("ใส่เกณฑ์ชุดนี้ลงในงานนี้อย่างไร", "How to put this set into the assignment")}</span>
              {([["replace", t("แทนที่เกณฑ์ปัจจุบัน", "Replace the current criteria")], ["add", t("เพิ่มต่อท้าย", "Be added to the current ones")]] as const).map(([key, label]) => (
                <button
                  key={key} type="button" role="radio" aria-checked={mode === key} onClick={() => setMode(key)}
                  className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${mode === key ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"}`}
                >
                  {label}
                </button>
              ))}
              <p data-testid="picker-mode-help" aria-live="polite" className="basis-full text-xs leading-relaxed text-[var(--text-secondary)]">
                {mode === "replace"
                  ? t("ลบเกณฑ์ที่กรอกไว้ในหน้านี้ตอนนี้ แล้วใช้ชุดที่เลือกแทนทั้งหมด", "The criteria currently in the editor are removed and this set takes their place.")
                  : t("เก็บเกณฑ์ที่กรอกไว้แล้วไว้ และต่อชุดที่เลือกท้ายสุด (รหัส C เรียงต่อจากเดิม)", "The criteria already in the editor stay, and this set is added after them (the C-codes carry on).")}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
