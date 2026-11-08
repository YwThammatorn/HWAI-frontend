"use client";

import { useState, Dispatch, SetStateAction } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { RubricCriterion, CriterionLevel, AssignmentAttachment, levelShare } from "@/lib/assignments";
import RubricPickerModal, { type PickedCriterion } from "@/components/RubricPickerModal";
import { useRubricLibrary } from "@/lib/rubricLibrary";
import { useCourses } from "@/lib/courses";
import Modal from "@/components/Modal";
import { buildCriteria, pickAiTemplate, briefLanguage, blankLevels, resizeLevels, levelDescription, levelsUniform, rubricLevelCount } from "@/lib/rubricTemplates";
import { levelTone } from "@/lib/rubricLevels";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
// Shared by the "New Assignment" form and the standalone rubric editor page, so
// both edit criteria exactly the same way. The parent owns the draft state and
// decides when to persist it (see finalizeCriteria).

const LEVEL_LABEL_MAP: Record<string, string> = {
  ดีเยี่ยม: "Excellent",
  ดีมาก: "Excellent",
  ไม่ผ่าน: "Fail",
  ดี: "Good",
  พอใช้: "Fair",
  ต้องปรับปรุง: "Needs Improvement",
};

function getDisplayLabel(label: string, lang: string): string {
  if (lang === "en") return LEVEL_LABEL_MAP[label] ?? label;
  return label;
}

export interface CriterionDraft {
  id: string;
  name: string;
  description: string;
  points: string;
  levels: CriterionLevel[];
  /** CLOs this criterion measures */
  cloIds: string[];
}

const defaultLevels = (): CriterionLevel[] => [
  { label: "ดีเยี่ยม", description: "" },
  { label: "ดี", description: "" },
  { label: "ต้องปรับปรุง", description: "" },
];

export function toDraft(c: RubricCriterion): CriterionDraft {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    points: String(c.maxPoints),
    levels: c.levels?.length ? c.levels : defaultLevels(),
    cloIds: c.cloIds ?? [],
  };
}

/** `levelCount` = how many levels the rubric already uses, so a criterion added later matches the others (14/10/2569). */
export function newCriterionDraft(name: string, points = "0", levelCount?: number): CriterionDraft {
  return { id: crypto.randomUUID(), name, description: "", points, levels: levelCount && levelCount !== 3 ? blankLevels(levelCount) : defaultLevels(), cloIds: [] };
}

export { levelsUniform, rubricLevelCount };

const pctText = (share: number) => `${Math.round(share * 10000) / 100}%`;

export function criteriaTotalPoints(criteria: CriterionDraft[]): number {
  return criteria.reduce((sum, c) => sum + (Math.round(parseFloat(c.points)) || 0), 0);
}

/** At least one criterion, each actually worth something — points are free-form
 *  (unlike the old weight model, there's no forced total to hit). */
export function criteriaPointsOk(criteria: CriterionDraft[]): boolean {
  return criteria.length > 0 && criteria.every((c) => (Math.round(parseFloat(c.points)) || 0) > 0);
}

/** Drafts -> persisted criteria. Points are now the source of truth (23/9/2569); weight is
 *  derived from each criterion's share of the total, purely for display on the read-only
 *  rubric views that still show a percentage. */
export function finalizeCriteria(criteria: CriterionDraft[], untitled: string): RubricCriterion[] {
  const pts = criteria.map((c) => Math.round(parseFloat(c.points)) || 0);
  const total = pts.reduce((sum, p) => sum + p, 0);
  return criteria.map((c, i) => ({
    id: c.id,
    name: c.name.trim() || untitled,
    description: c.description.trim(),
    weight: total > 0 ? Math.round((pts[i] / total) * 100) : 0,
    maxPoints: pts[i],
    levels: c.levels,
    ...(c.cloIds.length > 0 ? { cloIds: c.cloIds } : {}),
  }));
}

/** Everything about the criteria that changes how work is scored — i.e. all of it except the CLO tags. Comparing this
 *  (not the whole draft) is how "the rubric changed, grading restarts" ignores a teacher who only re-tagged CLOs. */
export function scoringSignature(criteria: CriterionDraft[]): string {
  return JSON.stringify(criteria.map(({ cloIds: _cloIds, ...scoring }) => scoring));
}

export interface CloOption { id: string; code: string; text: string }

// A rubric scale runs best → worst; teachers can use anywhere from 2 to 6 levels.
const MIN_LEVELS = 2;
const MAX_LEVELS = 6;

interface AiSuggestion { name: string; description: string; points: number; levels: CriterionLevel[] }

// The assistant proposes a 4-step scale (best → worst) so each suggested criterion arrives as a real rubric.
const AI_LEVEL_LABELS = ["ดีเยี่ยม", "ดี", "พอใช้", "ต้องปรับปรุง"];

export default function RubricCriteriaEditor({
  criteria,
  setCriteria,
  assignmentName,
  assignmentDescription = "",
  assignmentAttachments = [],
  clos,
  cloHref,
  courseId,
  assignmentId,
  onSourceRubric,
  flagged,
}: {
  /** Criteria Calibration pointed at (criterion id → what it found), 14/10/2569: each gets its note and a "let the AI adjust it" button. */
  flagged?: Record<string, string>;
  /** Told which rubric a "Use a rubric from before" set was copied from, so the page can store it as `Rubric.sourceRubricId`. */
  onSourceRubric?: (rubricId: string) => void;
  /** The course this rubric is for — switches on "Use a rubric from before" and "Save to library". */
  courseId?: string;
  /** The assignment being edited (never offered as its own source). */
  assignmentId?: string;
  /** The course's CLOs. Leave undefined to hide the CLO row; an empty list shows a "no CLOs yet" hint. */
  clos?: CloOption[];
  /** Where to send the teacher to add CLOs */
  cloHref?: string;
  criteria: CriterionDraft[];
  setCriteria: Dispatch<SetStateAction<CriterionDraft[]>>;
  assignmentName: string;
  /** Pre-fills the AI Rubric Assistant's brief together with the name, so the teacher doesn't retype it. */
  assignmentDescription?: string;
  /** Attached files / images / links — their names and links go into the brief too. */
  assignmentAttachments?: AssignmentAttachment[];
}) {
  const { lang, t } = useLanguage();
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiStep, setAiStep] = useState<"brief" | "loading" | "results">("brief");
  const [aiBrief, setAiBrief] = useState("");
  // reuse (12/10/2569): pick a rubric used before / keep this one in the subject's library
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const { addEntry } = useRubricLibrary();
  const { getCourse } = useCourses();

  const totalPoints = criteriaTotalPoints(criteria);
  const pointsOk = criteriaPointsOk(criteria);

  function updateCriterion(cid: string, field: keyof Omit<CriterionDraft, "id" | "levels">, value: string) {
    setCriteria((prev) => prev.map((c) => (c.id === cid ? { ...c, [field]: value } : c)));
  }

  function toggleClo(cid: string, cloId: string) {
    setCriteria((prev) => prev.map((c) => (c.id !== cid ? c : { ...c, cloIds: c.cloIds.includes(cloId) ? c.cloIds.filter((x) => x !== cloId) : [...c.cloIds, cloId] })));
  }

  function updateLevel(cid: string, li: number, field: keyof CriterionLevel, value: string) {
    setCriteria((prev) => prev.map((c) => {
      if (c.id !== cid) return c;
      return { ...c, levels: c.levels.map((lv, i) => (i === li ? { ...lv, [field]: value } : lv)) };
    }));
  }

  // One level count for the whole rubric (14/10/2569): adding or removing a level happens on EVERY criterion at once.
  // A new level slots in just above the lowest one (the scale stays best → worst); removing drops that same one, so best and worst stay.
  function setLevelCount(n: number) {
    if (n < MIN_LEVELS || n > MAX_LEVELS) return;
    setCriteria((prev) => prev.map((c) => {
      if (c.levels.length === n) return c;
      const levels = [...c.levels];
      while (levels.length < n) {
        const pos = levels.length - 1;
        const label = levels.some((lv) => lv.label === "พอใช้") ? t(`ระดับที่ ${levels.length}`, `Level ${levels.length}`) : "พอใช้";
        levels.splice(pos, 0, { label, description: levelDescription(pos, levels.length + 1, c.name || t("เกณฑ์นี้", "this criterion"), lang) });
      }
      while (levels.length > n && levels.length > 2) levels.splice(levels.length - 2, 1);
      return { ...c, levels };
    }));
  }

  // Old data can still hold criteria with different counts: the "let the AI even them out" button reshapes them all to the usual one.
  function unifyLevels() {
    const n = rubricLevelCount(criteria);
    setCriteria((prev) => prev.map((c) => ({ ...c, levels: resizeLevels(c.levels, n, c.name || t("เกณฑ์นี้", "this criterion"), lang) })));
  }

  function generateLevels(cid: string) {
    const c = criteria.find((x) => x.id === cid);
    if (!c) return;
    setGenerating((prev) => ({ ...prev, [cid]: true }));
    setTimeout(() => {
      const n = c.name || t("เกณฑ์นี้", "this criterion");
      setCriteria((prev) =>
        prev.map((x) =>
          x.id !== cid ? x : {
            ...x,
            levels: x.levels.map((lv, i) => ({ ...lv, description: levelDescription(i, x.levels.length, n, lang) })),
          }
        )
      );
      setGenerating((prev) => ({ ...prev, [cid]: false }));
    }, 900);
  }

  // What the teacher already entered on this page: name, description and the attachments' names / links
  // (the assistant can't read file contents yet, so it only gets what they are called).
  function assignmentBrief(): string {
    const kindLabel = { file: t("ไฟล์", "file"), image: t("รูปภาพ", "image"), link: t("ลิงก์", "link") };
    const attached = assignmentAttachments.map((a) => `${a.name} (${kindLabel[a.kind]}${a.source === "url" && a.ref !== a.name ? `: ${a.ref}` : ""})`);
    return [
      assignmentName.trim(),
      assignmentDescription.trim(),
      attached.length > 0 ? `${t("ไฟล์แนบ", "Attachments")}: ${attached.join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }

  // The brief starts out as that, so the assistant is one click away instead of a blank form; the
  // "Fill from assignment" button pulls it again after the teacher has edited or cleared the brief.
  function openAiAssistant() {
    setAiBrief(assignmentBrief());
    setAiSuggestions([]);
    setAiStep("brief");
    setAiOpen(true);
  }

  function generateAiSuggestions() {
    setAiStep("loading");
    setTimeout(() => {
      // A brief about UX/UI, an exam or code gets the rubric that fits it (4 levels, level-scored — see lib/rubricTemplates.ts);
      // anything else keeps the general-purpose suggestions below.
      const writeIn = briefLanguage(aiBrief, lang === "en" ? "en" : "th");   // the brief's language, not the screen's
      const tpl = pickAiTemplate(aiBrief);
      if (tpl) {
        setAiSuggestions(buildCriteria(tpl.criteria, 100, writeIn).map((c) => ({ name: c.name, description: c.description, points: c.maxPoints, levels: c.levels })));
        setAiStep("results");
        return;
      }
      const base = writeIn === "en"
        ? [
            { name: "Content Completeness", description: "Covers all key points as required", points: 40 },
            { name: "Accuracy", description: "Information and analysis are academically correct", points: 30 },
            { name: "Presentation & Structure", description: "Content organized systematically and clearly", points: 20 },
            { name: "Creativity", description: "Shows initiative and analytical perspective", points: 10 },
          ]
        : [
            { name: "ความครบถ้วนของเนื้อหา", description: "ครอบคลุมประเด็นสำคัญทั้งหมดตามที่กำหนด", points: 40 },
            { name: "ความถูกต้องและแม่นยำ", description: "ข้อมูลและการวิเคราะห์มีความถูกต้องตามหลักวิชา", points: 30 },
            { name: "การนำเสนอและโครงสร้าง", description: "จัดเรียงเนื้อหาได้อย่างเป็นระบบและชัดเจน", points: 20 },
            { name: "ความคิดสร้างสรรค์", description: "แสดงความคิดริเริ่มและมุมมองเชิงวิเคราะห์", points: 10 },
          ];
      setAiSuggestions(base.map((b) => ({
        ...b,
        levels: AI_LEVEL_LABELS.map((label, i) => ({ label, description: levelDescription(i, AI_LEVEL_LABELS.length, b.name, writeIn) })),
      })));
      setAiStep("results");
    }, 1500);
  }

  // Applies exactly what the preview showed, levels included.
  function applyAiSuggestions() {
    setCriteria(aiSuggestions.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      description: s.description,
      points: String(s.points),
      levels: s.levels.map((lv) => ({ ...lv })),
      cloIds: [],   // the teacher ticks the CLOs afterwards
    })));
    setAiOpen(false);
  }

  function applyPicked(picked: PickedCriterion[], mode: "replace" | "add", meta: { sourceRubricId?: string } = {}) {
    if (meta.sourceRubricId) onSourceRubric?.(meta.sourceRubricId);
    setCriteria((prev) => {
      const offset = mode === "add" ? prev.length : 0;
      // every criterion of the rubric has the same number of levels: an added set follows what is already there, a replacing set follows itself
      const target = mode === "add" && prev.length > 0 ? rubricLevelCount(prev) : rubricLevelCount(picked.map((p) => ({ levels: p.levels ?? [] })).filter((p) => p.levels.length > 0)) ;
      // a criterion named "C2 · …" takes its place in the NEW list: C1, C2, C3 … with no gaps or repeats after skips and replacements
      const drafts: CriterionDraft[] = picked.map((p, i) => {
        const d = newCriterionDraft(p.name.replace(/^C\d+ · /, `C${offset + i + 1} · `), String(p.points));
        const nm = d.name || t("เกณฑ์นี้", "this criterion");
        return { ...d, description: p.description, levels: p.levels ? resizeLevels(p.levels, target, nm, lang) : blankLevels(target, lang), cloIds: p.cloIds };
      });
      return mode === "add" ? [...prev, ...drafts] : drafts;
    });
  }

  function openSave() {
    setSaveName(assignmentName.trim());
    setSaveOpen(true);
  }

  function saveToLibrary() {
    const name = saveName.trim();
    if (!name) return;
    addEntry({
      name,
      courseTemplateId: courseId ? getCourse(courseId)?.courseTemplateId : undefined,
      criteria: finalizeCriteria(criteria, t("เกณฑ์ไม่มีชื่อ", "Untitled criterion")),
      sourceAssignmentId: assignmentId,
    });
    setSaveOpen(false);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 3000);
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, newCriterionDraft(t(`เกณฑ์ที่ ${prev.length + 1}`, `Criterion ${prev.length + 1}`), "0", prev.length > 0 ? rubricLevelCount(prev) : undefined)]);
  }

  function removeCriterion(cid: string, name: string) {
    if (criteria.length <= 1) return;
    if (!window.confirm(t(`ลบเกณฑ์ "${name}" ถาวร?`, `Permanently remove criterion "${name}"?`))) return;
    setCriteria((prev) => prev.filter((c) => c.id !== cid));
  }

  return (
    <>
      {/* Points total + tools */}
      <div className="flex items-stretch gap-3 mb-5 flex-wrap">
        <div className={`flex-1 min-w-[280px] flex items-center justify-between px-5 py-3 rounded-xl text-sm font-medium ${
          pointsOk ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-bright)]" : "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] border border-[var(--s-warn-bd)]"
        }`}>
          <div className="flex items-center gap-2">
            {pointsOk ? (
              <Icon name="check" size="sm" />
            ) : (
              <Icon name="alert-triangle" size="sm" />
            )}
            <span>
              {pointsOk
                ? t("ทุกเกณฑ์มีคะแนนแล้ว พร้อมบันทึก", "Every criterion has points — ready to save")
                : t("ทุกเกณฑ์ต้องมีคะแนนมากกว่า 0", "Every criterion needs more than 0 points")}
            </span>
          </div>
          <span className="font-mono text-base font-bold">{t(`รวม ${totalPoints} คะแนน`, `${totalPoints} pts total`)}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={openAiAssistant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-xs text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors font-medium"
          >
            <Icon name="star" size="sm" />
            {t("AI ช่วยสร้างเกณฑ์", "AI Rubric Assistant")}
          </button>
          {courseId && (
            <>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-xs text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors font-medium"
              >
                <Icon name="history" size="sm" />
                {t("ใช้ rubric จากงานก่อนหน้า", "Use a rubric from before")}
              </button>
              <button
                type="button"
                onClick={openSave}
                disabled={!pointsOk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="save" size="sm" />
                {t("บันทึกลงคลัง", "Save to library")}
              </button>
              <span role="status" className="text-xs font-medium text-[var(--s-ok-text)]">{savedNote ? t("บันทึกลงคลังแล้ว", "Saved to the library") : ""}</span>
            </>
          )}
          <div className="w-px h-4 bg-[var(--border)]" />
          <button
            type="button"
            disabled
            title={t("ฟีเจอร์นี้จะพร้อมใช้งานเร็ว ๆ นี้", "This feature is coming soon")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] cursor-not-allowed select-none"
          >
            <Icon name="download" size="sm" />
            {t("นำเข้า Rubric", "Import Rubric")}
          </button>
        </div>
      </div>

      {/* One level count for the whole rubric (14/10/2569) */}
      {criteria.length > 0 && (
        <div data-testid="level-control" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("จำนวนระดับของ rubric", "Levels in this rubric")}</p>
            <p className="text-xs text-[var(--text-secondary)]">{t("ทุกเกณฑ์ใช้จำนวนระดับเท่ากัน — เพิ่มหรือลดที่นี่ ทุกเกณฑ์เปลี่ยนตามกัน", "Every criterion uses the same number of levels — add or remove one here and all of them follow")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLevelCount(rubricLevelCount(criteria) - 1)}
              disabled={rubricLevelCount(criteria) <= MIN_LEVELS}
              aria-label={t("ลดหนึ่งระดับในทุกเกณฑ์", "Remove a level from every criterion")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-base font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
            >−</button>
            <span data-testid="level-count" className="min-w-[5.5rem] text-center text-sm font-semibold tabular-nums text-[var(--text-primary)]">{t(`${rubricLevelCount(criteria)} ระดับ`, `${rubricLevelCount(criteria)} levels`)}</span>
            <button
              type="button"
              onClick={() => setLevelCount(rubricLevelCount(criteria) + 1)}
              disabled={rubricLevelCount(criteria) >= MAX_LEVELS}
              aria-label={t("เพิ่มหนึ่งระดับในทุกเกณฑ์", "Add a level to every criterion")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-base font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
            >+</button>
          </div>
        </div>
      )}
      {criteria.length > 0 && !levelsUniform(criteria) && (
        <div role="alert" data-testid="levels-mixed" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-5 py-3 text-sm text-[var(--s-warn-text)]">
          <span>{t(`เกณฑ์มีจำนวนระดับไม่เท่ากัน (${[...new Set(criteria.map((c) => c.levels.length))].sort((a, b) => a - b).join(" / ")} ระดับ) — บันทึกไม่ได้จนกว่าจะเท่ากัน`, `The criteria have different numbers of levels (${[...new Set(criteria.map((c) => c.levels.length))].sort((a, b) => a - b).join(" / ")}) — it can't be saved until they match`)}</span>
          <button type="button" onClick={unifyLevels} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--s-warn-bd)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--s-warn-text)] hover:bg-[var(--s-warn-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]">
            {t(`ให้ AI ปรับให้เป็น ${rubricLevelCount(criteria)} ระดับเท่ากัน`, `Let the AI even them out to ${rubricLevelCount(criteria)} levels`)}
          </button>
        </div>
      )}

      {/* How a level turns into points — same for every criterion (the rubric file's "level → score" sheet) */}
      {criteria.length > 0 && levelsUniform(criteria) && (
        <p data-testid="level-scale" className="mb-4 -mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-secondary)]">{t("คิดคะแนนตามระดับ", "Level → points")}:</span>{" "}
          {criteria[0].levels.map((_, li, all) => `${t("ระดับ", "Level")} ${all.length - 1 - li} = ${pctText(levelShare(li, all.length))}`).join(" · ")}{" "}
          {t("ของคะแนนเต็มของเกณฑ์", "of the criterion's points")}
        </p>
      )}

      {/* Criteria list */}
      <div className="space-y-4">
        {criteria.map((c, idx) => {
          const pctOfTotal = totalPoints > 0 ? Math.round(((Math.round(parseFloat(c.points)) || 0) / totalPoints) * 100) : 0;
          return (
            <div key={c.id} data-testid={`criterion-card-${c.id}`} className={`bg-[var(--bg-surface)] rounded-2xl border shadow-sm overflow-hidden ${flagged?.[c.id] ? "border-[var(--s-warn-bd)] ring-2 ring-[var(--s-warn-text)]" : "border-[var(--border-subtle)]"}`}>
              {flagged?.[c.id] && (
                <div data-testid={`flag-note-${c.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-5 py-3 text-sm text-[var(--s-warn-text)]">
                  <span className="min-w-0 flex-1"><span className="font-semibold">{t("ข้อเสนอแนะจากการปรับเทียบ", "From the calibration")}:</span> {flagged[c.id]}</span>
                  <button
                    type="button"
                    data-testid={`flag-ai-${c.id}`}
                    onClick={() => generateLevels(c.id)}
                    disabled={generating[c.id]}
                    title={t("เขียนคำอธิบายของทุกระดับในเกณฑ์นี้ใหม่ให้ต่างกันชัดขึ้น", "Rewrites the wording of every level of this criterion so they are easier to tell apart")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--s-warn-bd)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--s-warn-text)] hover:bg-[var(--s-warn-bg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >
                    {t("ให้ AI ปรับเกณฑ์นี้ตามข้อเสนอแนะ", "Let the AI adjust this criterion")}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-mono text-[var(--text-muted)] w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                <input
                  value={c.name}
                  onChange={(e) => updateCriterion(c.id, "name", e.target.value)}
                  className="flex-1 min-w-0 text-sm font-semibold text-[var(--text-primary)] bg-transparent border-0 outline-none focus:bg-[var(--bg-subtle)] rounded-lg px-2 py-1 -ml-2 transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="ชื่อเกณฑ์"
                  aria-label={t("ชื่อเกณฑ์", "Criterion name")}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-medium">
                    {t("คะแนน", "Points")}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={c.points}
                      onChange={(e) => updateCriterion(c.id, "points", e.target.value)}
                      aria-label={t("คะแนน", "Points")}
                      className={`w-14 text-center text-sm font-semibold border rounded-lg px-2 py-1 outline-none focus:ring-2 transition-colors ${
                        (Math.round(parseFloat(c.points)) || 0) > 0
                          ? "border-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)]/30"
                          : "border-[var(--border)] text-[var(--text-secondary)] focus:ring-[var(--border)]"
                      }`}
                    />
                    <span className="text-xs text-[var(--text-secondary)] font-medium">{t("คะแนน", "pts")}</span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-mono">≈ {pctOfTotal}%</span>
                  <button
                    type="button"
                    onClick={() => generateLevels(c.id)}
                    disabled={generating[c.id]}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-bright)] text-xs text-[var(--accent)] font-medium hover:bg-[var(--accent-subtle)] transition-colors disabled:opacity-50"
                  >
                    {generating[c.id] ? (
                      <Icon name="spinner" size="sm" className="animate-spin" />
                    ) : (
                      <Icon name="star" size="sm" />
                    )}
                    {t("สร้าง", "Generate")}
                  </button>
                </div>
                <IconButton icon="trash" label={t("ลบเกณฑ์นี้", "Remove criterion")} tone="danger" onClick={() => removeCriterion(c.id, c.name)} disabled={criteria.length <= 1} />
              </div>

              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                  {t("คำอธิบายสำหรับนักศึกษา", "Description for Student")}
                </label>
                <textarea
                  value={c.description}
                  onChange={(e) => updateCriterion(c.id, "description", e.target.value)}
                  rows={2}
                  placeholder="อธิบายสิ่งที่นักศึกษาต้องแสดงในเกณฑ์นี้..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
                />
              </div>

              {clos && (
                <div className="px-5 py-4 border-b border-[var(--border-subtle)]" data-testid={`clo-row-${idx}`}>
                  <p className="block text-xs text-[var(--text-secondary)] mb-1.5">{t("CLO ที่เกณฑ์นี้วัด", "CLOs this criterion measures")}</p>
                  {clos.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t("วิชานี้ยังไม่มี CLO — ", "This course has no CLOs yet — ")}
                      {cloHref && <a href={cloHref} className="font-medium text-[var(--accent)] underline underline-offset-2">{t("เพิ่มที่แท็บ CLO", "add them on the CLO tab")}</a>}
                    </p>
                  ) : (
                    <>
                      <div role="group" aria-label={t("เลือก CLO", "Pick CLOs")} className="flex flex-wrap gap-2">
                        {clos.map((clo) => {
                          const on = c.cloIds.includes(clo.id);
                          return (
                            <button
                              key={clo.id}
                              type="button"
                              aria-pressed={on}
                              title={clo.text}
                              onClick={() => toggleClo(c.id, clo.id)}
                              className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${on ? "border-[var(--accent-solid)] bg-[var(--accent-solid)] text-[var(--accent-solid-text)]" : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                            >
                              {clo.code}
                            </button>
                          );
                        })}
                      </div>
                      {c.cloIds.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-[var(--text-secondary)]">
                          {c.cloIds.map((id) => clos.find((x) => x.id === id)).filter(Boolean).map((clo) => (
                            <li key={clo!.id}><span className="font-semibold text-[var(--text-secondary)]">{clo!.code}</span> {clo!.text}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 1px gaps over a tinted backdrop draw the dividers, so they stay clean when 4+ levels wrap */}
              <div className="grid gap-px bg-[var(--bg-app)] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {c.levels.map((lv, li) => {
                  const col = levelTone(li, c.levels.length);
                  const levelName = getDisplayLabel(lv.label, lang);
                  const levelPts = Math.round((Math.round(parseFloat(c.points)) || 0) * levelShare(li, c.levels.length));
                  return (
                    <div key={li} className="bg-[var(--bg-surface)] px-5 py-4">
                      {/* "Level 3 · 15 pts" on top, the level's own (editable) name under it — as the rubric file's column headings */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                        <span className="flex-1 min-w-0 text-[11px] text-[var(--text-muted)] tabular-nums">
                          {t("ระดับ", "Level")} {c.levels.length - 1 - li} · <span data-testid="level-points" className="font-semibold text-[var(--text-secondary)]">{levelPts} {t("คะแนน", "pts")}</span>
                        </span>
                      </div>
                      <input
                        value={levelName}
                        onChange={(e) => updateLevel(c.id, li, "label", e.target.value)}
                        aria-label={t("ชื่อระดับ", "Level name")}
                        className={`w-full min-w-0 mb-2 text-xs font-semibold bg-transparent border-0 outline-none rounded px-1 -mx-1 focus:bg-[var(--bg-subtle)] ${col.label}`}
                      />
                      <textarea
                        value={lv.description}
                        onChange={(e) => updateLevel(c.id, li, "description", e.target.value)}
                        rows={2}
                        placeholder="อธิบายลักษณะงาน..."
                        aria-label={`${c.name || t("เกณฑ์", "Criterion")} — ${levelName}`}
                        className="w-full text-xs text-[var(--text-secondary)] resize-none border-0 outline-none bg-transparent placeholder:text-[var(--text-muted)] leading-relaxed"
                      />
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addCriterion}
        className="w-full mt-4 py-3.5 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)]/30 transition-all flex items-center justify-center gap-2"
      >
        <Icon name="plus" />
        {t("เพิ่มเกณฑ์ย่อยใหม่", "Add New Criterion")}
      </button>

      {courseId && (
        <>
          <RubricPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            courseId={courseId}
            assignmentId={assignmentId}
            hasCriteria={criteria.some((c) => c.name.trim() !== "" || c.description.trim() !== "")}
            levelCount={criteria.length > 0 ? rubricLevelCount(criteria) : undefined}
            clos={clos}
            brief={assignmentBrief()}
            onApply={applyPicked}
          />
          <Modal
            open={saveOpen}
            onClose={() => setSaveOpen(false)}
            size="sm"
            title={t("บันทึก rubric ลงคลัง", "Save rubric to the library")}
            description={t("เก็บไว้ใช้ซ้ำกับวิชานี้ในปีหน้า หรืองานอื่น", "Keep it to reuse next year or in another assignment of this subject")}
            footer={
              <>
                <button type="button" onClick={() => setSaveOpen(false)} className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ยกเลิก", "Cancel")}</button>
                <button type="button" onClick={saveToLibrary} disabled={!saveName.trim()} className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("บันทึก", "Save")}</button>
              </>
            }
          >
            <label htmlFor="library-name" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">{t("ชื่อ rubric", "Rubric name")}</label>
            <input
              id="library-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
          </Modal>
        </>
      )}

      {/* AI Rubric Assistant — brief → suggestions (with each criterion's level rubric) */}
      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        size="lg"
        title={t("AI ช่วยสร้างเกณฑ์", "AI Rubric Assistant")}
        description={aiStep === "brief"
          ? t("บอก AI ว่าชิ้นงานนี้ต้องการวัดอะไร — ดึงจากข้อมูลที่กรอกไว้ให้แล้ว แก้ได้", "Tell the AI what this assignment should assess — pre-filled from what you entered, edit freely")
          : undefined}
        footer={
          aiStep === "brief" ? (
            <>
              <button type="button" onClick={() => setAiOpen(false)} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                type="button"
                onClick={generateAiSuggestions}
                disabled={!aiBrief.trim()}
                className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("สร้างเกณฑ์", "Generate criteria")}
              </button>
            </>
          ) : aiStep === "results" ? (
            <>
              <button type="button" onClick={() => setAiOpen(false)} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                type="button"
                onClick={applyAiSuggestions}
                className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("ใช้คำแนะนำ", "Apply Suggestions")}
              </button>
            </>
          ) : undefined
        }
      >
        {aiStep === "brief" && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label htmlFor="ai-brief" className="block text-sm font-medium text-[var(--text-primary)]">
                {t("ชิ้นงานนี้ต้องการวัดอะไร", "What should this assignment assess?")}
              </label>
              <button
                type="button"
                onClick={() => {
                  const pulled = assignmentBrief();
                  // never clobber what they typed: empty → fill, otherwise add what's missing underneath
                  setAiBrief((cur) => !cur.trim() ? pulled : cur.includes(pulled) ? cur : `${cur.trimEnd()}\n\n${pulled}`);
                }}
                disabled={!assignmentBrief()}
                title={assignmentBrief() ? undefined : t("ยังไม่มีชื่อ คำอธิบาย หรือไฟล์แนบให้ดึง", "There's no name, description or attachment to pull yet")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                <Icon name="download" size="sm" />
                {t("ดึงจากข้อมูลงาน", "Fill from assignment")}
              </button>
            </div>
            <textarea
              id="ai-brief"
              autoFocus
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              rows={6}
              placeholder="เช่น รายงานวิเคราะห์ผู้ใช้ ต้องมีการสัมภาษณ์ สรุป insight และข้อเสนอแนะการออกแบบ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              {t("ยิ่งระบุรายละเอียด (รูปแบบงาน สิ่งที่ต้องส่ง จุดที่เน้น) เกณฑ์ที่ได้จะยิ่งตรงงาน", "The more you say (format, deliverables, what matters), the closer the criteria will fit")}
            </p>
          </div>
        )}

        {aiStep === "loading" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <IconTile icon="spinner" spin size="lg" shape="round" tone="accent" />
            <div className="text-center" role="status">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("กำลังวิเคราะห์ชิ้นงาน...", "Analyzing assignment...")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("AI กำลังสร้างเกณฑ์และระดับคะแนนที่เหมาะสม", "AI is generating suitable criteria and levels")}</p>
            </div>
          </div>
        )}

        {aiStep === "results" && (
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-sm text-[var(--text-secondary)] min-w-0">
                {t("AI แนะนำเกณฑ์ต่อไปนี้สำหรับ", "AI suggests the following criteria for")}{" "}
                <span className="font-medium text-[var(--text-primary)]">{assignmentName || t("ชิ้นงานนี้", "this assignment")}</span>
              </p>
              <button
                type="button"
                onClick={() => setAiStep("brief")}
                className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                {t("แก้ข้อมูลที่ให้ AI", "Edit brief")}
              </button>
            </div>
            <div className="space-y-3">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-solid)] flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{s.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--accent)] shrink-0 tabular-nums">{s.points} {t("คะแนน", "pts")}</span>
                  </div>
                  {/* Same 1px-gap divider trick as the editor's own level grid */}
                  <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                    {s.levels.map((lv, li) => {
                      const col = levelTone(li, s.levels.length);
                      return (
                        <div key={li} className="bg-[var(--bg-surface)] px-4 py-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} aria-hidden="true" />
                            <span className={`text-xs font-semibold ${col.label}`}>{getDisplayLabel(lv.label, lang)}</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{lv.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
