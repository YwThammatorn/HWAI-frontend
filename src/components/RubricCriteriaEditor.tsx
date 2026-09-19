"use client";

import { useState, Dispatch, SetStateAction } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { RubricCriterion, CriterionLevel } from "@/lib/assignments";

// Shared by the "New Assignment" form and the standalone rubric editor page, so
// both edit criteria exactly the same way. The parent owns the draft state and
// decides when to persist it (see finalizeCriteria).

const LEVEL_LABEL_MAP: Record<string, string> = {
  ดีเยี่ยม: "Excellent",
  ดี: "Good",
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
  weight: string;
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
    weight: String(c.weight),
    levels: c.levels?.length ? c.levels : defaultLevels(),
  };
}

export function newCriterionDraft(name: string, weight = "0"): CriterionDraft {
  return { id: crypto.randomUUID(), name, description: "", weight, levels: defaultLevels() };
}

export function criteriaTotalWeight(criteria: CriterionDraft[]): number {
  return criteria.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
}

export function criteriaWeightOk(criteria: CriterionDraft[]): boolean {
  return Math.abs(criteriaTotalWeight(criteria) - 100) <= 0.5;
}

/** Drafts -> persisted criteria (points derived from the assignment's max score). */
export function finalizeCriteria(criteria: CriterionDraft[], maxPoints: number, untitled: string): RubricCriterion[] {
  return criteria.map((c) => ({
    id: c.id,
    name: c.name.trim() || untitled,
    description: c.description.trim(),
    weight: parseFloat(c.weight) || 0,
    maxPoints: Math.round(maxPoints * ((parseFloat(c.weight) || 0) / 100)),
    levels: c.levels,
  }));
}

const LEVEL_COLORS = [
  { label: "text-green-600", dot: "bg-green-500" },
  { label: "text-amber-600", dot: "bg-amber-400" },
  { label: "text-[var(--s-err-text)]", dot: "bg-[var(--s-err-text)]" },
];

export default function RubricCriteriaEditor({
  criteria,
  setCriteria,
  maxPoints,
  assignmentName,
}: {
  criteria: CriterionDraft[];
  setCriteria: Dispatch<SetStateAction<CriterionDraft[]>>;
  /** Assignment's full score — only used for the "≈ N pts" hint per criterion. */
  maxPoints: number;
  assignmentName: string;
}) {
  const { lang, t } = useLanguage();
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<{ name: string; description: string; weight: number }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const totalWeight = criteriaTotalWeight(criteria);
  const weightOk = criteriaWeightOk(criteria);

  function updateCriterion(cid: string, field: keyof Omit<CriterionDraft, "id" | "levels">, value: string) {
    setCriteria((prev) => prev.map((c) => (c.id === cid ? { ...c, [field]: value } : c)));
  }

  function updateLevel(cid: string, li: number, value: string) {
    setCriteria((prev) => prev.map((c) => {
      if (c.id !== cid) return c;
      return { ...c, levels: c.levels.map((lv, i) => (i === li ? { ...lv, description: value } : lv)) };
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
            levels: lang === "en"
              ? [
                  { label: x.levels[0]?.label ?? "ดีเยี่ยม", description: `Clearly demonstrates ${n.toLowerCase()} with strong evidence and meets all expectations.` },
                  { label: x.levels[1]?.label ?? "ดี", description: `Demonstrates ${n.toLowerCase()} at an acceptable level but with some areas for improvement.` },
                  { label: x.levels[2]?.label ?? "ต้องปรับปรุง", description: `${n} is insufficient and requires significant revision and development.` },
                ]
              : [
                  { label: x.levels[0]?.label ?? "ดีเยี่ยม", description: `แสดงความเข้าใจ ${n} ได้อย่างชัดเจนและครบถ้วน มีหลักฐานประกอบที่น่าเชื่อถือ` },
                  { label: x.levels[1]?.label ?? "ดี", description: `แสดง ${n} ได้ในระดับที่ยอมรับได้ แต่ยังมีบางส่วนที่ต้องปรับปรุง` },
                  { label: x.levels[2]?.label ?? "ต้องปรับปรุง", description: `${n} ยังไม่เพียงพอ จำเป็นต้องแก้ไขและพัฒนาเพิ่มเติมอย่างมีนัยสำคัญ` },
                ],
          }
        )
      );
      setGenerating((prev) => ({ ...prev, [cid]: false }));
    }, 900);
  }

  function openAiAssistant() {
    setAiOpen(true);
    setAiSuggestions([]);
    setAiLoading(true);
    setTimeout(() => {
      setAiSuggestions(
        lang === "en"
          ? [
              { name: "Content Completeness", description: "Covers all key points as required", weight: 40 },
              { name: "Accuracy", description: "Information and analysis are academically correct", weight: 30 },
              { name: "Presentation & Structure", description: "Content organized systematically and clearly", weight: 20 },
              { name: "Creativity", description: "Shows initiative and analytical perspective", weight: 10 },
            ]
          : [
              { name: "ความครบถ้วนของเนื้อหา", description: "ครอบคลุมประเด็นสำคัญทั้งหมดตามที่กำหนด", weight: 40 },
              { name: "ความถูกต้องและแม่นยำ", description: "ข้อมูลและการวิเคราะห์มีความถูกต้องตามหลักวิชา", weight: 30 },
              { name: "การนำเสนอและโครงสร้าง", description: "จัดเรียงเนื้อหาได้อย่างเป็นระบบและชัดเจน", weight: 20 },
              { name: "ความคิดสร้างสรรค์", description: "แสดงความคิดริเริ่มและมุมมองเชิงวิเคราะห์", weight: 10 },
            ]
      );
      setAiLoading(false);
    }, 1500);
  }

  function applyAiSuggestions() {
    setCriteria(aiSuggestions.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      description: s.description,
      weight: String(s.weight),
      levels: lang === "en"
        ? [
            { label: "ดีเยี่ยม", description: `Excellent ${s.name.toLowerCase()}` },
            { label: "ดี", description: `Good ${s.name.toLowerCase()}` },
            { label: "ต้องปรับปรุง", description: `${s.name} needs improvement` },
          ]
        : [
            { label: "ดีเยี่ยม", description: `แสดง${s.name}ได้อย่างยอดเยี่ยม` },
            { label: "ดี", description: `แสดง${s.name}ได้ในระดับที่ดี` },
            { label: "ต้องปรับปรุง", description: `${s.name}ยังต้องพัฒนาเพิ่มเติม` },
          ],
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
      {/* Weight total + tools */}
      <div className="flex items-stretch gap-3 mb-5 flex-wrap">
        <div className={`flex-1 min-w-[280px] flex items-center justify-between px-5 py-3 rounded-xl text-sm font-medium ${
          weightOk ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-amber-50 text-amber-700 border border-amber-100"
        }`}>
          <div className="flex items-center gap-2">
            {weightOk ? (
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
              {weightOk
                ? t("น้ำหนักรวมครบ 100% พร้อมบันทึก", "Total weight is 100% — ready to save")
                : t(
                    `น้ำหนักรวมปัจจุบัน ${totalWeight.toFixed(0)}% — ต้องรวมได้ 100% เพื่อบันทึก`,
                    `Current total weight is ${totalWeight.toFixed(0)}% — must equal 100% to save`
                  )}
            </span>
          </div>
          <span className="font-mono text-base font-bold">{totalWeight.toFixed(0)} / 100%</span>
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
          const pts = Math.round(maxPoints * ((parseFloat(c.weight) || 0) / 100));
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
                    {t("น้ำหนัก", "Weight")}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={c.weight}
                      onChange={(e) => updateCriterion(c.id, "weight", e.target.value)}
                      aria-label={t("น้ำหนัก (%)", "Weight (%)")}
                      className={`w-14 text-center text-sm font-semibold border rounded-lg px-2 py-1 outline-none focus:ring-2 transition-colors ${
                        parseFloat(c.weight) > 0
                          ? "border-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)]/30"
                          : "border-gray-200 text-gray-500 focus:ring-gray-200"
                      }`}
                    />
                    <span className="text-xs text-gray-500 font-medium">%</span>
                  </div>
                  <span className="text-xs text-gray-300 font-mono">≈ {pts} pts</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
                {c.levels.map((lv, li) => {
                  const col = LEVEL_COLORS[li] ?? LEVEL_COLORS[2];
                  return (
                    <div key={li} className="px-5 py-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                        <span className={`text-xs font-semibold ${col.label}`}>
                          {getDisplayLabel(lv.label, lang)}
                        </span>
                      </div>
                      <textarea
                        value={lv.description}
                        onChange={(e) => updateLevel(c.id, li, e.target.value)}
                        rows={2}
                        placeholder={t("อธิบายลักษณะงาน...", "Describe work characteristics...")}
                        aria-label={`${c.name || t("เกณฑ์", "Criterion")} — ${getDisplayLabel(lv.label, lang)}`}
                        className="w-full text-xs text-gray-600 resize-none border-0 outline-none bg-transparent placeholder:text-gray-300 leading-relaxed"
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
        className="w-full mt-4 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-teal-50/30 transition-all flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        {t("เพิ่มเกณฑ์ย่อยใหม่", "Add New Criterion")}
      </button>

      {/* AI Rubric Assistant Modal */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAiOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <h3 className="text-base font-bold text-[var(--text-primary)]">{t("AI ช่วยสร้างเกณฑ์", "AI Rubric Assistant")}</h3>
              </div>
              <button type="button" onClick={() => setAiOpen(false)} aria-label={t("ปิด", "Close")} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {aiLoading ? (
                <div className="flex flex-col items-center py-10 gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {t("กำลังวิเคราะห์ชิ้นงาน...", "Analyzing assignment...")}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t("AI กำลังสร้างเกณฑ์ที่เหมาะสม", "AI is generating suitable criteria")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    {t("AI แนะนำเกณฑ์ต่อไปนี้สำหรับ", "AI suggests the following criteria for")}{" "}
                    <span className="font-medium text-[var(--text-primary)]">{assignmentName || t("ชิ้นงานนี้", "this assignment")}</span>
                  </p>
                  <div className="space-y-2 mb-5">
                    {aiSuggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50/50 border border-teal-100">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent-solid)] flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] font-bold">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.description}</p>
                        </div>
                        <span className="text-xs font-semibold text-[var(--accent)] shrink-0">{s.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAiOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {t("ยกเลิก", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={applyAiSuggestions}
                      className="flex-1 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
                    >
                      {t("ใช้คำแนะนำ", "Apply Suggestions")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
