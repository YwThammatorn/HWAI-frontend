"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useCLOs, CLO } from "@/lib/clo";
import { useGradingCategories, GradingCategory } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";

const PLO_OPTIONS = ["PLO1", "PLO2", "PLO3", "PLO4", "PLO5"];

export default function CLOPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getCLOsByCourse, addCLO, updateCLO, removeCLO } = useCLOs();

  const CONFIRM_LEAVE = t("มีข้อมูลที่ยังไม่ได้บันทึก\nต้องการออกจากหน้านี้หรือไม่?", "Unsaved changes.\nLeave this page?");
  const CONFIRM_CANCEL = t("การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการยกเลิกหรือไม่?", "Changes will not be saved.\nCancel editing?");

  const { getCategoriesByCourse, addCategory, updateCategory, removeCategory } = useGradingCategories();

  const course = getCourse(id);
  const clos = getCLOsByCourse(id);
  const categories = getCategoriesByCourse(id);
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  const [formMode, setFormMode] = useState<"idle" | "add" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formText, setFormText] = useState("");
  const [formPlo, setFormPlo] = useState<string[]>([]);

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catWeight, setCatWeight] = useState("");

  const formDirty = formMode !== "idle" && (formCode !== "" || formText !== "" || formPlo.length > 0);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formDirty]);

  function navAway(to: string) {
    if (formDirty && !window.confirm(CONFIRM_LEAVE)) return;
    router.push(to);
  }

  function openAdd() {
    if (formMode !== "idle" && formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setEditingId(null);
    setFormCode(`CLO${clos.length + 1}`);
    setFormText("");
    setFormPlo([]);
    setFormMode("add");
  }

  function openEdit(clo: CLO) {
    if (formMode !== "idle" && formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setEditingId(clo.id);
    setFormCode(clo.code);
    setFormText(clo.text);
    setFormPlo([...clo.ploMapping]);
    setFormMode("edit");
  }

  function cancelForm() {
    if (formDirty && !window.confirm(CONFIRM_CANCEL)) return;
    setFormMode("idle");
    setEditingId(null);
  }

  function handleSave() {
    const code = formCode.trim();
    const text = formText.trim();
    if (!code || !text) return;
    if (formMode === "add") {
      addCLO({ courseId: id, code, text, ploMapping: formPlo });
    } else if (formMode === "edit" && editingId) {
      updateCLO(editingId, { code, text, ploMapping: formPlo });
    }
    setFormMode("idle");
    setEditingId(null);
  }

  function handleDelete(clo: CLO) {
    if (!window.confirm(t(`ลบ "${clo.code}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${clo.code}"? Cannot be undone.`))) return;
    removeCLO(clo.id);
  }

  function togglePlo(plo: string) {
    setFormPlo(prev => prev.includes(plo) ? prev.filter(p => p !== plo) : [...prev, plo]);
  }

  function openAddCategory() {
    setCatEditingId(null);
    setCatName("");
    setCatWeight("");
    setCatFormOpen(true);
  }

  function openEditCategory(cat: GradingCategory) {
    setCatEditingId(cat.id);
    setCatName(cat.name);
    setCatWeight(String(cat.weight));
    setCatFormOpen(true);
  }

  function cancelCategoryForm() {
    setCatFormOpen(false);
    setCatEditingId(null);
  }

  function handleSaveCategory() {
    const name = catName.trim();
    const weight = Number(catWeight);
    if (!name || !Number.isFinite(weight) || weight <= 0) return;
    if (catEditingId) {
      updateCategory(catEditingId, { name, weight });
    } else {
      addCategory({ courseId: id, name, weight });
    }
    setCatFormOpen(false);
    setCatEditingId(null);
  }

  function handleDeleteCategory(cat: GradingCategory) {
    if (!window.confirm(t(`ลบหมวด "${cat.name}" ถาวร? ไม่สามารถกู้คืนได้`, `Permanently delete "${cat.name}"? Cannot be undone.`))) return;
    removeCategory(cat.id);
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-sm text-gray-500">
          {t("ไม่พบวิชา", "Course not found")}
        </main>
    );
  }

  const isFormValid = formCode.trim().length > 0 && formText.trim().length > 0;
  const showEmpty = clos.length === 0 && formMode === "idle";

  return (
      <main className="w-full px-8 py-10">

        {/* Back */}
        <button
          onClick={() => navAway(`/teacher/courses/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับหน้าวิชา", "Back to course")}
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ผลลัพธ์การเรียนรู้รายวิชา (CLO)", "Course Learning Outcomes (CLO)")}</h1>
            <p className="text-sm text-gray-500">{course.name}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              disabled
              title={t("ฟีเจอร์นี้จะพร้อมใช้งานเร็ว ๆ นี้", "This feature is coming soon")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-300 cursor-not-allowed select-none"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {t("ให้ AI ช่วยร่าง", "AI Draft")}
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("เพิ่ม CLO เอง", "Add CLO")}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
          <svg className="shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <p className="text-xs text-blue-600 leading-relaxed">
            <strong>PLO (Program Learning Outcome)</strong>{" "}
            {t(
              "คือผลลัพธ์การเรียนรู้ระดับหลักสูตร — CLO แต่ละข้อควรสนับสนุนอย่างน้อย 1 PLO เพื่อให้ระบบรายงาน CLO Attainment ได้ถูกต้อง",
              "are program-level learning outcomes — each CLO should support at least one PLO for accurate CLO Attainment reporting."
            )}
          </p>
        </div>

        {/* Empty state */}
        {showEmpty ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มี CLO กำหนดไว้", "No CLOs defined yet")}</p>
            <p className="text-xs text-gray-500 mb-6">{t("เพิ่ม CLO เพื่อวัดผลลัพธ์การเรียนรู้และ CLO Attainment ของนักศึกษา", "Add CLOs to measure student learning outcomes and CLO Attainment")}</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("เพิ่ม CLO แรก", "Add First CLO")}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Table header */}
            <div className="grid gap-0 border-b border-gray-100" style={{ gridTemplateColumns: "88px 1fr 148px 170px 76px" }}>
              {[t("รหัส", "Code"), t("ข้อความ CLO", "CLO Text"), "PLO", t("เกณฑ์ที่ผูก", "Linked Criteria"), ""].map((h, i) => (
                <div key={i} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</div>
              ))}
            </div>

            {/* Table body */}
            {clos.map((clo, idx) => (
              <div
                key={clo.id}
                className={[
                  "grid gap-0 items-start py-4 transition-colors",
                  idx < clos.length - 1 ? "border-b border-gray-50" : "",
                  editingId === clo.id ? "bg-[#F0FFFE] opacity-60" : "hover:bg-gray-50/50",
                ].join(" ")}
                style={{ gridTemplateColumns: "88px 1fr 148px 170px 76px" }}
              >
                {/* Code */}
                <div className="px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-teal-50 text-[var(--accent)] text-xs font-bold font-mono">
                    {clo.code}
                  </span>
                </div>

                {/* Text */}
                <div className="px-4 text-sm text-[var(--text-primary)] leading-relaxed">{clo.text}</div>

                {/* PLO */}
                <div className="px-4 flex flex-wrap gap-1 pt-0.5">
                  {clo.ploMapping.length > 0 ? (
                    clo.ploMapping.map(p => (
                      <span key={p} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 text-xs font-medium">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>

                {/* เกณฑ์ผูก */}
                <div className="px-4 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {t("ยังไม่มีเกณฑ์ผูก", "No linked criteria")}
                  </span>
                </div>

                {/* Actions */}
                <div className="px-4 flex items-center gap-1">
                  <button
                    onClick={() => openEdit(clo)}
                    disabled={editingId === clo.id}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                    title={t("แก้ไข", "Edit")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(clo)}
                    className="p-1.5 rounded-lg hover:bg-[var(--s-err-bg)] text-gray-500 hover:text-[var(--s-err-text)] transition-colors"
                    title={t("ลบ", "Delete")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Inline form panel */}
            {formMode !== "idle" && (
              <div className="border-t-2 border-[var(--accent)]/20 bg-teal-50/40 p-6">
                <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">
                  {formMode === "add" ? t("เพิ่ม CLO ใหม่", "Add New CLO") : `${t("แก้ไข", "Edit")} ${editingId ? clos.find(c => c.id === editingId)?.code : ""}`}
                </p>
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "104px 1fr" }}>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {t("รหัส", "Code")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <input
                      value={formCode}
                      onChange={e => setFormCode(e.target.value)}
                      placeholder="CLO1"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {t("ข้อความ CLO", "CLO Text")} <span className="text-[var(--s-err-text)]">*</span>
                    </label>
                    <textarea
                      value={formText}
                      onChange={e => setFormText(e.target.value)}
                      placeholder={t("นักศึกษาสามารถ...", "Students can...")}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-500 mb-2">{t("PLO ที่สนับสนุน", "Supporting PLOs")}</label>
                  <div className="flex gap-2 flex-wrap">
                    {PLO_OPTIONS.map(plo => (
                      <button
                        key={plo}
                        type="button"
                        onClick={() => togglePlo(plo)}
                        className={[
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          formPlo.includes(plo)
                            ? "bg-violet-500 text-white border-violet-500"
                            : "border-gray-200 text-gray-500 bg-white hover:border-violet-400 hover:text-violet-500",
                        ].join(" ")}
                      >
                        {plo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isFormValid}
                    className="px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("บันทึก", "Save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer count */}
        {clos.length > 0 && (
          <p className="text-xs text-gray-500 mt-3 text-right">{clos.length} CLO</p>
        )}

        {/* Grading Categories — สัดส่วนคะแนนของรายวิชา */}
        <section className="mt-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{t("สัดส่วนคะแนน", "Grading Categories")}</h2>
              <p className="text-sm text-gray-500">
                {t("กำหนดหมวดงานและสัดส่วน % ของเกรดวิชานี้ — เวลาสร้างงานใหม่จะเลือกหมวดได้", "Define grading categories and their % of the final grade — assignments pick a category when created.")}
              </p>
            </div>
            <button
              onClick={openAddCategory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("เพิ่มหมวด", "Add Category")}
            </button>
          </div>

          {categories.length === 0 && !catFormOpen ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มีหมวดคะแนน", "No grading categories yet")}</p>
              <p className="text-xs text-gray-500 mb-5">{t("เช่น Quiz, Midterm, Final, Project ฯลฯ", "e.g. Quiz, Midterm, Final, Project")}</p>
              <button
                onClick={openAddCategory}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors"
              >
                {t("เพิ่มหมวดแรก", "Add First Category")}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid gap-0 border-b border-gray-100" style={{ gridTemplateColumns: "1fr 120px 76px" }}>
                {[t("หมวดงาน", "Category"), t("สัดส่วน", "Weight"), ""].map((h, i) => (
                  <div key={i} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</div>
                ))}
              </div>

              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className={[
                    "grid gap-0 items-center py-3 transition-colors",
                    idx < categories.length - 1 ? "border-b border-gray-50" : "",
                    catEditingId === cat.id ? "bg-[#F0FFFE] opacity-60" : "hover:bg-gray-50/50",
                  ].join(" ")}
                  style={{ gridTemplateColumns: "1fr 120px 76px" }}
                >
                  <div className="px-4 text-sm text-[var(--text-primary)]">{cat.name}</div>
                  <div className="px-4 text-sm font-semibold text-[var(--accent)] tabular-nums">{cat.weight}%</div>
                  <div className="px-4 flex items-center gap-1">
                    <button
                      onClick={() => openEditCategory(cat)}
                      disabled={catEditingId === cat.id}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      title={t("แก้ไข", "Edit")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 rounded-lg hover:bg-[var(--s-err-bg)] text-gray-500 hover:text-[var(--s-err-text)] transition-colors"
                      title={t("ลบ", "Delete")}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {catFormOpen && (
                <div className="border-t-2 border-[var(--accent)]/20 bg-teal-50/40 p-6">
                  <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">
                    {catEditingId ? t("แก้ไขหมวด", "Edit Category") : t("เพิ่มหมวดใหม่", "Add New Category")}
                  </p>
                  <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "1fr 120px" }}>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t("ชื่อหมวด", "Category Name")} <span className="text-[var(--s-err-text)]">*</span>
                      </label>
                      <input
                        value={catName}
                        onChange={e => setCatName(e.target.value)}
                        placeholder={t("เช่น Midterm", "e.g. Midterm")}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t("สัดส่วน %", "Weight %")} <span className="text-[var(--s-err-text)]">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={catWeight}
                        onChange={e => setCatWeight(e.target.value)}
                        placeholder="30"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelCategoryForm}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t("ยกเลิก", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      disabled={!catName.trim() || !Number(catWeight)}
                      className="px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("บันทึก", "Save")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {categories.length > 0 && (
            <div className={[
              "flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl text-sm font-medium",
              totalWeight === 100
                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                : "bg-amber-50 text-amber-600",
            ].join(" ")}>
              {totalWeight === 100 ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              )}
              <span className="tabular-nums">
                {totalWeight === 100
                  ? t(`รวม ${totalWeight}% ครบแล้ว`, `Total ${totalWeight}% — complete`)
                  : t(`รวมได้ ${totalWeight}% ต้องเท่ากับ 100%`, `Total ${totalWeight}% — must add up to 100%`)}
              </span>
            </div>
          )}
        </section>
      </main>
  );
}
