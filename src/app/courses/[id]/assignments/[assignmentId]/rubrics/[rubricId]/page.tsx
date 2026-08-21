"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useAssignments, RubricCriterion, CriterionLevel } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

const LEVEL_LABEL_MAP: Record<string, string> = {
  ดีเยี่ยม: "Excellent",
  ดี: "Good",
  ต้องปรับปรุง: "Needs Improvement",
};

function getDisplayLabel(label: string, lang: string): string {
  if (lang === "en") return LEVEL_LABEL_MAP[label] ?? label;
  return label;
}

interface CriterionDraft {
  id: string;
  name: string;
  description: string;
  weight: string;
  levels: CriterionLevel[];
}

function toDraft(c: RubricCriterion): CriterionDraft {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    weight: String(c.weight),
    levels: c.levels?.length
      ? c.levels
      : [
          { label: "ดีเยี่ยม", description: "" },
          { label: "ดี", description: "" },
          { label: "ต้องปรับปรุง", description: "" },
        ],
  };
}

const LEVEL_COLORS = [
  { border: "border-green-200", bg: "bg-green-50", label: "text-green-600", dot: "bg-green-500" },
  { border: "border-amber-200", bg: "bg-amber-50", label: "text-amber-600", dot: "bg-amber-400" },
  { border: "border-red-200", bg: "bg-red-50", label: "text-red-500", dot: "bg-red-400" },
];

export default function RubricEditorPage() {
  const { id, assignmentId, rubricId } = useParams<{ id: string; assignmentId: string; rubricId: string }>();
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getRubric, updateRubric } = useAssignments();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const rubric = getRubric(rubricId);

  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [rubricName, setRubricName] = useState("");
  const [saved, setSaved] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<{ name: string; description: string; weight: number }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const origRef = useRef({ criteriaJson: "", name: "" });

  useEffect(() => {
    if (rubric) {
      const drafts = rubric.criteria.map(toDraft);
      const json = JSON.stringify(drafts);
      setCriteria(drafts);
      setRubricName(rubric.name);
      origRef.current = { criteriaJson: json, name: rubric.name };
    }
  }, [rubric?.id]);

  const isDirty = !saved && (
    rubricName !== origRef.current.name ||
    JSON.stringify(criteria) !== origRef.current.criteriaJson
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function navAway(to: string) {
    const msg = t(
      "การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?",
      "Changes will not be saved.\nDo you want to leave this page?"
    );
    if (isDirty && !window.confirm(msg)) return;
    router.push(to);
  }

  const totalWeight = criteria.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
  const weightOk = Math.abs(totalWeight - 100) <= 0.5;

  const updateCriterion = useCallback((cid: string, field: keyof Omit<CriterionDraft, "id" | "levels">, value: string) => {
    setCriteria(prev => prev.map(c => c.id === cid ? { ...c, [field]: value } : c));
  }, []);

  const updateLevel = useCallback((cid: string, li: number, value: string) => {
    setCriteria(prev => prev.map(c => {
      if (c.id !== cid) return c;
      const levels = c.levels.map((lv, i) => i === li ? { ...lv, description: value } : lv);
      return { ...c, levels };
    }));
  }, []);

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
      setSaved(false);
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
    const newCriteria: CriterionDraft[] = aiSuggestions.map((s) => ({
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
    }));
    setCriteria(newCriteria);
    setSaved(false);
    setAiOpen(false);
  }

  function addCriterion() {
    const newC: CriterionDraft = {
      id: crypto.randomUUID(),
      name: t(`เกณฑ์ที่ ${criteria.length + 1}`, `Criterion ${criteria.length + 1}`),
      description: "",
      weight: "0",
      levels: [
        { label: "ดีเยี่ยม", description: "" },
        { label: "ดี", description: "" },
        { label: "ต้องปรับปรุง", description: "" },
      ],
    };
    setCriteria(prev => [...prev, newC]);
  }

  function removeCriterion(cid: string, name: string) {
    if (criteria.length <= 1) return;
    const msg = t(`ลบเกณฑ์ "${name}" ถาวร?`, `Permanently remove criterion "${name}"?`);
    if (!window.confirm(msg)) return;
    setCriteria(prev => prev.filter(c => c.id !== cid));
  }

  function handleSave() {
    if (!weightOk) return;
    const finalized: RubricCriterion[] = criteria.map(c => ({
      id: c.id,
      name: c.name.trim() || t("ไม่มีชื่อ", "Untitled"),
      description: c.description.trim(),
      weight: parseFloat(c.weight) || 0,
      maxPoints: Math.round((assignment?.maxPoints ?? 100) * ((parseFloat(c.weight) || 0) / 100)),
      levels: c.levels,
    }));
    updateRubric(rubricId, { name: rubricName.trim() || rubric?.name || "Rubric", criteria: finalized });
    setSaved(true);
    setTimeout(() => router.push(`/courses/${id}/assignments/${assignmentId}/edit`), 800);
  }

  if (!course || !assignment || !rubric) {
    return (
      <AppShell>
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/courses/${id}/assignments/${assignmentId}/edit`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้าแก้ไขชิ้นงาน", "Back to assignment")}
          </Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="w-full max-w-[800px] mx-auto px-8 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-6 flex-wrap">
          <Link href="/courses" className="hover:text-[var(--accent)] transition-colors">
            {t("วิชาทั้งหมด", "All Courses")}
          </Link>
          <span>/</span>
          <Link href={`/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <button onClick={() => navAway(`/courses/${id}/assignments/${assignmentId}/edit`)} className="hover:text-[var(--accent)] transition-colors">
            {assignment.name}
          </button>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{rubric.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              {t("กำหนดเกณฑ์การให้คะแนน", "Define Criteria")}
            </h1>
            <p className="text-sm text-gray-500">
              {t("ตั้งค่าเกณฑ์ที่ HWAI Agent จะใช้ในการตรวจงาน", "Set up the grading rules for the HWAI Agent")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={openAiAssistant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-xs text-[var(--accent)] hover:bg-teal-50 transition-colors font-medium"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              AI Rubric Assistant
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button
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

        {/* Rubric name */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t("ชื่อ Rubric", "Rubric Name")}
          </label>
          <input
            value={rubricName}
            onChange={e => { setRubricName(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
            placeholder={t("ชื่อ Rubric", "Rubric name")}
          />
        </div>

        {/* Weight total bar */}
        <div className={`flex items-center justify-between px-5 py-3 rounded-xl mb-5 text-sm font-medium ${
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

        {/* Criteria list */}
        <div className="space-y-4">
          {criteria.map((c, idx) => {
            const pts = Math.round((assignment.maxPoints) * ((parseFloat(c.weight) || 0) / 100));
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
                  <span className="text-xs font-mono text-gray-300 w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                  <input
                    value={c.name}
                    onChange={e => updateCriterion(c.id, "name", e.target.value)}
                    className="flex-1 text-sm font-semibold text-[var(--text-primary)] bg-transparent border-0 outline-none focus:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition-colors placeholder:text-gray-300"
                    placeholder={t("ชื่อเกณฑ์", "Criterion name")}
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
                        onChange={e => updateCriterion(c.id, "weight", e.target.value)}
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
                      onClick={() => generateLevels(c.id)}
                      disabled={generating[c.id]}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-[var(--accent)] font-medium hover:bg-teal-100 transition-colors disabled:opacity-60"
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
                    onClick={() => removeCriterion(c.id, c.name)}
                    disabled={criteria.length <= 1}
                    title={t("ลบเกณฑ์นี้", "Remove criterion")}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <div className="px-5 py-4 border-b border-gray-50">
                  <label className="block text-xs text-gray-500 mb-1.5">
                    {t("คำอธิบายสำหรับนักศึกษา", "Description for Student")}
                  </label>
                  <textarea
                    value={c.description}
                    onChange={e => updateCriterion(c.id, "description", e.target.value)}
                    rows={2}
                    placeholder={t(
                      "อธิบายสิ่งที่นักศึกษาต้องแสดงในเกณฑ์นี้...",
                      "Describe what students must demonstrate for this criterion..."
                    )}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors placeholder:text-gray-300"
                  />
                </div>

                {/* Level cards */}
                <div className="grid grid-cols-3 divide-x divide-gray-50 px-0">
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
                          onChange={e => updateLevel(c.id, li, e.target.value)}
                          rows={2}
                          placeholder={t("อธิบายลักษณะงาน...", "Describe work characteristics...")}
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

        {/* Add criterion */}
        <button
          onClick={addCriterion}
          className="w-full mt-4 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-teal-50/30 transition-all flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          {t("เพิ่มเกณฑ์ย่อยใหม่", "Add New Criterion")}
        </button>

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => navAway(`/courses/${id}/assignments/${assignmentId}/edit`)}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t("ยกเลิก", "Discard")}
          </button>
          <div className="flex items-center gap-3">
            {!weightOk && (
              <span className="text-xs text-amber-500">
                {t("น้ำหนักรวมต้องเท่ากับ 100%", "Total weight must equal 100%")}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!weightOk || saved}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                saved
                  ? "bg-green-500 text-white"
                  : weightOk
                    ? "bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] shadow-sm shadow-teal-200"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              {saved ? (
                <span className="flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {t("บันทึกแล้ว", "Saved!")}
                </span>
              ) : t("บันทึก Rubric", "Save Rubric")}
            </button>
          </div>
        </div>
      </main>

      {/* AI Rubric Assistant Modal */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAiOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#0F766E">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <h3 className="text-base font-bold text-[var(--text-primary)]">AI Rubric Assistant</h3>
              </div>
              <button onClick={() => setAiOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {aiLoading ? (
                <div className="flex flex-col items-center py-10 gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2">
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
                    <span className="font-medium text-[var(--text-primary)]">{assignment.name}</span>
                  </p>
                  <div className="space-y-2 mb-5">
                    {aiSuggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50/50 border border-teal-100">
                        <div className="w-6 h-6 rounded-full bg-[#0F766E] flex items-center justify-center shrink-0">
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
                      onClick={() => setAiOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {t("ยกเลิก", "Cancel")}
                    </button>
                    <button
                      onClick={applyAiSuggestions}
                      className="flex-1 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#0E7490] text-white text-sm font-semibold transition-colors"
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
    </AppShell>
  );
}
