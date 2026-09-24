"use client";

import { useState, Dispatch, SetStateAction } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { RubricCriterion, CriterionLevel } from "@/lib/assignments";
import Modal from "@/components/Modal";

// Shared by the "New Assignment" form and the standalone rubric editor page, so
// both edit criteria exactly the same way. The parent owns the draft state and
// decides when to persist it (see finalizeCriteria).

const LEVEL_LABEL_MAP: Record<string, string> = {
  ดีเยี่ยม: "Excellent",
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
  };
}

export function newCriterionDraft(name: string, points = "0"): CriterionDraft {
  return { id: crypto.randomUUID(), name, description: "", points, levels: defaultLevels() };
}

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
  }));
}

// A rubric scale runs best → worst; teachers can use anywhere from 2 to 6 levels.
const MIN_LEVELS = 2;
const MAX_LEVELS = 6;

// Green → red ramp. A level's colour comes from its position in the scale, so
// 3 levels still read green / amber / red and 4–6 fill in lime and orange.
const LEVEL_TONES = [
  { label: "text-green-600", dot: "bg-green-500" },
  { label: "text-lime-600", dot: "bg-lime-500" },
  { label: "text-amber-600", dot: "bg-amber-400" },
  { label: "text-orange-600", dot: "bg-orange-500" },
  { label: "text-[var(--s-err-text)]", dot: "bg-[var(--s-err-text)]" },
];

function levelRatio(i: number, total: number): number {
  return total <= 1 ? 0 : i / (total - 1);
}

function levelTone(i: number, total: number) {
  return LEVEL_TONES[Math.round(levelRatio(i, total) * (LEVEL_TONES.length - 1))];
}

/** Placeholder wording for "Generate", chosen by where the level sits on the scale. */
function levelDescription(i: number, total: number, name: string, lang: string): string {
  const r = levelRatio(i, total);
  const en = lang === "en";
  const n = en ? name.toLowerCase() : name;
  if (r === 0) return en
    ? `Clearly demonstrates ${n} with strong evidence and meets all expectations.`
    : `แสดงความเข้าใจ ${n} ได้อย่างชัดเจนและครบถ้วน มีหลักฐานประกอบที่น่าเชื่อถือ`;
  if (r === 1) return en
    ? `${name} is insufficient and requires significant revision and development.`
    : `${name} ยังไม่เพียงพอ จำเป็นต้องแก้ไขและพัฒนาเพิ่มเติมอย่างมีนัยสำคัญ`;
  if (r < 0.5) return en
    ? `Demonstrates ${n} well and meets most expectations, with only minor gaps.`
    : `แสดง ${n} ได้ดี ตรงตามความคาดหวังเป็นส่วนใหญ่ มีข้อบกพร่องเล็กน้อย`;
  if (r === 0.5) return en
    ? `Demonstrates ${n} at an acceptable level but with some areas for improvement.`
    : `แสดง ${n} ได้ในระดับที่ยอมรับได้ แต่ยังมีบางส่วนที่ต้องปรับปรุง`;
  return en
    ? `Only partly demonstrates ${n}; several expectations are not yet met.`
    : `แสดง ${n} ได้เพียงบางส่วน ยังไม่ตรงตามความคาดหวังหลายประการ`;
}

interface AiSuggestion { name: string; description: string; points: number; levels: CriterionLevel[] }

// The assistant proposes a 4-step scale (best → worst) so each suggested criterion arrives as a real rubric.
const AI_LEVEL_LABELS = ["ดีเยี่ยม", "ดี", "พอใช้", "ต้องปรับปรุง"];

export default function RubricCriteriaEditor({
  criteria,
  setCriteria,
  assignmentName,
  assignmentDescription = "",
}: {
  criteria: CriterionDraft[];
  setCriteria: Dispatch<SetStateAction<CriterionDraft[]>>;
  assignmentName: string;
  /** Pre-fills the AI Rubric Assistant's brief together with the name, so the teacher doesn't retype it. */
  assignmentDescription?: string;
}) {
  const { lang, t } = useLanguage();
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiStep, setAiStep] = useState<"brief" | "loading" | "results">("brief");
  const [aiBrief, setAiBrief] = useState("");

  const totalPoints = criteriaTotalPoints(criteria);
  const pointsOk = criteriaPointsOk(criteria);

  function updateCriterion(cid: string, field: keyof Omit<CriterionDraft, "id" | "levels">, value: string) {
    setCriteria((prev) => prev.map((c) => (c.id === cid ? { ...c, [field]: value } : c)));
  }

  function updateLevel(cid: string, li: number, field: keyof CriterionLevel, value: string) {
    setCriteria((prev) => prev.map((c) => {
      if (c.id !== cid) return c;
      return { ...c, levels: c.levels.map((lv, i) => (i === li ? { ...lv, [field]: value } : lv)) };
    }));
  }

  // New levels slot in just above the lowest one so the scale stays best → worst.
  function addLevel(cid: string) {
    setCriteria((prev) => prev.map((c) => {
      if (c.id !== cid || c.levels.length >= MAX_LEVELS) return c;
      const label = c.levels.some((lv) => lv.label === "พอใช้")
        ? t(`ระดับที่ ${c.levels.length}`, `Level ${c.levels.length}`)
        : "พอใช้";
      const levels = [...c.levels];
      levels.splice(levels.length - 1, 0, { label, description: "" });
      return { ...c, levels };
    }));
  }

  function removeLevel(cid: string, li: number) {
    setCriteria((prev) => prev.map((c) => {
      if (c.id !== cid || c.levels.length <= MIN_LEVELS) return c;
      return { ...c, levels: c.levels.filter((_, i) => i !== li) };
    }));
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

  // The brief starts out as what the teacher already typed on this page (name + description), so the
  // assistant is one click away instead of a blank form — they can still edit or replace it.
  function openAiAssistant() {
    setAiBrief([assignmentName.trim(), assignmentDescription.trim()].filter(Boolean).join("\n"));
    setAiSuggestions([]);
    setAiStep("brief");
    setAiOpen(true);
  }

  function generateAiSuggestions() {
    setAiStep("loading");
    setTimeout(() => {
      const base = lang === "en"
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
        levels: AI_LEVEL_LABELS.map((label, i) => ({ label, description: levelDescription(i, AI_LEVEL_LABELS.length, b.name, lang) })),
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
    })));
    setAiOpen(false);
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, newCriterionDraft(t(`เกณฑ์ที่ ${prev.length + 1}`, `Criterion ${prev.length + 1}`))]);
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
          pointsOk ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-amber-50 text-amber-700 border border-amber-100"
        }`}>
          <div className="flex items-center gap-2">
            {pointsOk ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-xs text-[var(--accent)] hover:bg-teal-50 transition-colors font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {t("AI ช่วยสร้างเกณฑ์", "AI Rubric Assistant")}
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            type="button"
            disabled
            title={t("ฟีเจอร์นี้จะพร้อมใช้งานเร็ว ๆ นี้", "This feature is coming soon")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-300 cursor-not-allowed select-none"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {t("นำเข้า Rubric", "Import Rubric")}
          </button>
        </div>
      </div>

      {/* Criteria list */}
      <div className="space-y-4">
        {criteria.map((c, idx) => {
          const pctOfTotal = totalPoints > 0 ? Math.round(((Math.round(parseFloat(c.points)) || 0) / totalPoints) * 100) : 0;
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                <span className="text-xs font-mono text-gray-300 w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                <input
                  value={c.name}
                  onChange={(e) => updateCriterion(c.id, "name", e.target.value)}
                  className="flex-1 min-w-0 text-sm font-semibold text-[var(--text-primary)] bg-transparent border-0 outline-none focus:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition-colors placeholder:text-gray-300"
                  placeholder={t("ชื่อเกณฑ์", "Criterion name")}
                  aria-label={t("ชื่อเกณฑ์", "Criterion name")}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
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
                          : "border-gray-200 text-gray-500 focus:ring-gray-200"
                      }`}
                    />
                    <span className="text-xs text-gray-500 font-medium">{t("คะแนน", "pts")}</span>
                  </div>
                  <span className="text-xs text-gray-300 font-mono">≈ {pctOfTotal}%</span>
                  <button
                    type="button"
                    onClick={() => generateLevels(c.id)}
                    disabled={generating[c.id]}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-[var(--accent)] font-medium hover:bg-teal-100 transition-colors disabled:opacity-50"
                  >
                    {generating[c.id] ? (
                      <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    )}
                    {t("สร้าง", "Generate")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeCriterion(c.id, c.name)}
                  disabled={criteria.length <= 1}
                  title={t("ลบเกณฑ์นี้", "Remove criterion")}
                  aria-label={t("ลบเกณฑ์นี้", "Remove criterion")}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 border-b border-gray-50">
                <label className="block text-xs text-gray-500 mb-1.5">
                  {t("คำอธิบายสำหรับนักศึกษา", "Description for Student")}
                </label>
                <textarea
                  value={c.description}
                  onChange={(e) => updateCriterion(c.id, "description", e.target.value)}
                  rows={2}
                  placeholder={t(
                    "อธิบายสิ่งที่นักศึกษาต้องแสดงในเกณฑ์นี้...",
                    "Describe what students must demonstrate for this criterion..."
                  )}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors placeholder:text-gray-300"
                />
              </div>

              {/* 1px gaps over a tinted backdrop draw the dividers, so they stay clean when 4+ levels wrap */}
              <div className="grid gap-px bg-gray-100 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {c.levels.map((lv, li) => {
                  const col = levelTone(li, c.levels.length);
                  const levelName = getDisplayLabel(lv.label, lang);
                  return (
                    <div key={li} className="bg-white px-5 py-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                        <input
                          value={levelName}
                          onChange={(e) => updateLevel(c.id, li, "label", e.target.value)}
                          aria-label={t("ชื่อระดับ", "Level name")}
                          className={`flex-1 min-w-0 text-xs font-semibold bg-transparent border-0 outline-none rounded px-1 -mx-1 focus:bg-gray-50 ${col.label}`}
                        />
                        {c.levels.length > MIN_LEVELS && (
                          <button
                            type="button"
                            onClick={() => removeLevel(c.id, li)}
                            title={t("ลบระดับนี้", "Remove level")}
                            aria-label={`${t("ลบระดับ", "Remove level")} ${levelName}`}
                            className="p-1 rounded text-gray-300 hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors shrink-0"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      <textarea
                        value={lv.description}
                        onChange={(e) => updateLevel(c.id, li, "description", e.target.value)}
                        rows={2}
                        placeholder={t("อธิบายลักษณะงาน...", "Describe work characteristics...")}
                        aria-label={`${c.name || t("เกณฑ์", "Criterion")} — ${levelName}`}
                        className="w-full text-xs text-gray-600 resize-none border-0 outline-none bg-transparent placeholder:text-gray-300 leading-relaxed"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addLevel(c.id)}
                  disabled={c.levels.length >= MAX_LEVELS}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  {t("เพิ่มระดับ", "Add level")}
                </button>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {t(`${c.levels.length} / ${MAX_LEVELS} ระดับ`, `${c.levels.length} / ${MAX_LEVELS} levels`)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addCriterion}
        className="w-full mt-4 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-teal-50/30 transition-all flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        {t("เพิ่มเกณฑ์ย่อยใหม่", "Add New Criterion")}
      </button>

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
            <label htmlFor="ai-brief" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t("ชิ้นงานนี้ต้องการวัดอะไร", "What should this assignment assess?")}
            </label>
            <textarea
              id="ai-brief"
              autoFocus
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              rows={6}
              placeholder={t("เช่น รายงานวิเคราะห์ผู้ใช้ ต้องมีการสัมภาษณ์ สรุป insight และข้อเสนอแนะการออกแบบ", "e.g. A user-research report with interviews, key insights and design recommendations")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              {t("ยิ่งระบุรายละเอียด (รูปแบบงาน สิ่งที่ต้องส่ง จุดที่เน้น) เกณฑ์ที่ได้จะยิ่งตรงงาน", "The more you say (format, deliverables, what matters), the closer the criteria will fit")}
            </p>
          </div>
        )}

        {aiStep === "loading" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
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
