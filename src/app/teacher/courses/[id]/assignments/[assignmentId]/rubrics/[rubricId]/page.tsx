"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";
import RubricCriteriaEditor, {
  CriterionDraft, toDraft, criteriaWeightOk, finalizeCriteria,
} from "@/components/RubricCriteriaEditor";

export default function RubricEditorPage() {
  const { id, assignmentId, rubricId } = useParams<{ id: string; assignmentId: string; rubricId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getRubric, updateRubric } = useAssignments();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const rubric = getRubric(rubricId);

  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [rubricName, setRubricName] = useState("");
  const [saved, setSaved] = useState(false);

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

  const weightOk = criteriaWeightOk(criteria);

  function handleSave() {
    if (!weightOk) return;
    updateRubric(rubricId, {
      name: rubricName.trim() || rubric?.name || "Rubric",
      criteria: finalizeCriteria(criteria, assignment?.maxPoints ?? 100, t("ไม่มีชื่อ", "Untitled")),
    });
    setSaved(true);
    setTimeout(() => router.push(`/teacher/courses/${id}/assignments/${assignmentId}/edit`), 800);
  }

  if (!course || !assignment || !rubric) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้าแก้ไขชิ้นงาน", "Back to assignment")}
          </Link>
        </main>
    );
  }

  return (
    <main className="w-full px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-6 flex-wrap">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">
          {t("วิชาทั้งหมด", "All Courses")}
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <button onClick={() => navAway(`/teacher/courses/${id}/assignments/${assignmentId}/edit`)} className="hover:text-[var(--accent)] transition-colors">
          {assignment.name}
        </button>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{rubric.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1.5">
          {t("กำหนดเกณฑ์การให้คะแนน", "Define Criteria")}
        </h1>
        <p className="text-sm text-gray-500">
          {t("ตั้งค่าเกณฑ์ที่ HWAI Agent จะใช้ในการตรวจงาน", "Set up the grading rules for the HWAI Agent")}
        </p>
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

      <RubricCriteriaEditor
        criteria={criteria}
        setCriteria={setCriteria}
        maxPoints={assignment.maxPoints}
        assignmentName={assignment.name}
      />

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
        <button
          onClick={() => navAway(`/teacher/courses/${id}/assignments/${assignmentId}/edit`)}
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
                  ? "bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)]"
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
  );
}
