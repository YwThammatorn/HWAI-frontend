"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

export default function EditAssignmentPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const {
    getAssignment, updateAssignment, removeAssignment,
    getRubricsByAssignment, addRubric, removeRubric,
  } = useAssignments();

  const CONFIRM_MSG = t(
    "การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?",
    "Unsaved changes will be lost.\nLeave this page?"
  );

  const FILE_TYPE_OPTIONS: { id: Assignment["fileTypes"][number]; label: string }[] = [
    { id: "figma", label: "Figma" },
    { id: "pdf", label: "PDF" },
    { id: "image", label: t("รูปภาพ", "Image") },
  ];

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const linkedRubrics = getRubricsByAssignment(assignmentId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [acceptsFiles, setAcceptsFiles] = useState(true);
  const [fileTypes, setFileTypes] = useState<Assignment["fileTypes"]>(["figma", "pdf"]);
  const [submissionType, setSubmissionType] = useState<"individual" | "group">("individual");
  const [maxGroupSize, setMaxGroupSize] = useState("");
  const [saved, setSaved] = useState(false);

  const [showNewRubricForm, setShowNewRubricForm] = useState(false);
  const [newRubricName, setNewRubricName] = useState("");

  const origRef = useRef({
    name: "", description: "", dueDate: "", maxPoints: "",
    acceptsFiles: true, fileTypesJson: "[]",
    submissionType: "individual" as "individual" | "group",
    maxGroupSizeStr: "",
  });

  useEffect(() => {
    if (assignment) {
      const ft = assignment.fileTypes ?? ["figma", "pdf"];
      const st = (assignment.submissionType ?? "individual") as "individual" | "group";
      const gs = assignment.maxGroupSize != null ? String(assignment.maxGroupSize) : "";
      const orig = {
        name: assignment.name,
        description: assignment.description,
        dueDate: assignment.dueDate,
        maxPoints: String(assignment.maxPoints),
        acceptsFiles: assignment.acceptsFiles ?? true,
        fileTypesJson: JSON.stringify(ft),
        submissionType: st,
        maxGroupSizeStr: gs,
      };
      setName(orig.name);
      setDescription(orig.description);
      setDueDate(orig.dueDate);
      setMaxPoints(orig.maxPoints);
      setAcceptsFiles(orig.acceptsFiles);
      setFileTypes(ft);
      setSubmissionType(st);
      setMaxGroupSize(gs);
      origRef.current = orig;
    }
  }, [assignment?.id]);

  const todayStr = new Date().toISOString().split("T")[0];
  const minDate =
    origRef.current.dueDate && origRef.current.dueDate < todayStr
      ? origRef.current.dueDate : todayStr;

  const isDirty =
    !saved && (
      name !== origRef.current.name ||
      description !== origRef.current.description ||
      dueDate !== origRef.current.dueDate ||
      maxPoints !== origRef.current.maxPoints ||
      acceptsFiles !== origRef.current.acceptsFiles ||
      JSON.stringify(fileTypes) !== origRef.current.fileTypesJson ||
      submissionType !== origRef.current.submissionType ||
      maxGroupSize !== origRef.current.maxGroupSizeStr
    );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function navAway(to: string) {
    if (isDirty && !window.confirm(CONFIRM_MSG)) return;
    router.push(to);
  }

  function toggleFileType(ft: Assignment["fileTypes"][number]) {
    setFileTypes(prev => prev.includes(ft) ? prev.filter(x => x !== ft) : [...prev, ft]);
  }

  function handleSubmissionTypeChange(type: "individual" | "group") {
    setSubmissionType(type);
    if (type === "individual") setMaxGroupSize("");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateAssignment(assignmentId, {
      name: name.trim(),
      description: description.trim(),
      dueDate,
      maxPoints: parseInt(maxPoints) || 100,
      acceptsFiles,
      fileTypes: acceptsFiles ? fileTypes : [],
      submissionType,
      maxGroupSize: submissionType === "group" && maxGroupSize ? parseInt(maxGroupSize) : null,
    });
    setSaved(true);
    setTimeout(() => router.push(`/teacher/courses/${id}/assignments/${assignmentId}`), 800);
  }

  function handleDelete() {
    if (!window.confirm(t(
      `ลบ "${assignment?.name}" ถาวร? ไม่สามารถกู้คืนได้`,
      `Permanently delete "${assignment?.name}"? Cannot be undone.`
    ))) return;
    removeAssignment(assignmentId);
    router.push(`/teacher/courses/${id}/assignments`);
  }

  function handleAddRubric() {
    const rname = newRubricName.trim();
    if (!rname) return;
    const rubric = addRubric({ assignmentId, name: rname, criteria: [] });
    const current = getAssignment(assignmentId);
    if (current) updateAssignment(assignmentId, { rubricIds: [...current.rubricIds, rubric.id] });
    setNewRubricName("");
    setShowNewRubricForm(false);
  }

  function handleDeleteRubric(rubricId: string, rubricName: string) {
    if (!window.confirm(t(
      `ลบเกณฑ์ "${rubricName}" ถาวร? ไม่สามารถกู้คืนได้`,
      `Delete rubric "${rubricName}" permanently? Cannot be undone.`
    ))) return;
    removeRubric(rubricId);
    const current = getAssignment(assignmentId);
    if (current) updateAssignment(assignmentId, { rubricIds: current.rubricIds.filter(rid => rid !== rubricId) });
  }

  if (!course || !assignment) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับรายการชิ้นงาน", "Back to assignments")}
          </Link>
        </main>
    );
  }

  const isValid = name.trim().length > 0 && dueDate !== "" && (!acceptsFiles || fileTypes.length > 0);

  return (
      <main className="w-full max-w-[700px] mx-auto px-8 py-10">

        <button
          onClick={() => navAway(`/teacher/courses/${id}/assignments/${assignmentId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับหน้าชิ้นงาน", "Back to assignment")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("แก้ไขชิ้นงาน", "Edit Assignment")}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {t("กำลังแก้ไข", "Editing")}{" "}
          <span className="font-semibold text-[var(--text-primary)]">{assignment.name}</span>{" "}
          {t("ในวิชา", "in")} <span className="font-semibold text-[var(--text-primary)]">{course.name}</span>
        </p>

        <form onSubmit={handleSave} className="space-y-5">

          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="info" label={t("ข้อมูลทั่วไป", "General Information")} />
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t("ชื่อชิ้นงาน", "Assignment Name")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              required
            />
          </section>

          {/* Description */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="doc" label={t("รายละเอียดชิ้นงาน", "Description")} />
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
            />
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="cal" label={t("กำหนดเวลาและคะแนน", "Deadline & Score")} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t("วันครบกำหนด", "Due Date")} <span className="text-[var(--s-err-text)]">*</span>
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input
                    type="date" value={dueDate} min={minDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("คะแนนเต็ม", "Max Score")}</label>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {[10, 15, 25, 100].map((p) => (
                    <button key={p} type="button" onClick={() => setMaxPoints(String(p))}
                      className={["px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        maxPoints === String(p) ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)] border-[var(--accent)]" : "border-gray-200 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      ].join(" ")}>
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="1" max="1000" value={maxPoints}
                  onChange={(e) => setMaxPoints(e.target.value)}
                  placeholder={t("หรือพิมพ์เอง", "or type...")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Submission Settings */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="upload" label={t("การรับและรูปแบบงาน", "Submission Settings")} />

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("รับไฟล์จากนักศึกษา", "Accept Files")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("ปิดถ้างานนี้ไม่ต้องอัปโหลดไฟล์", "Disable if no upload needed")}</p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptsFiles(v => !v)}
                className={["relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", acceptsFiles ? "bg-[#2DD4BF]" : "bg-gray-200"].join(" ")}
              >
                <span className={["inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", acceptsFiles ? "translate-x-6" : "translate-x-1"].join(" ")} />
              </button>
            </div>

            {acceptsFiles && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-500 mb-2">{t("ประเภทไฟล์ที่รับ", "Accepted File Types")}</label>
                <div className="flex gap-2">
                  {FILE_TYPE_OPTIONS.map(({ id: fid, label }) => (
                    <button key={fid} type="button" onClick={() => toggleFileType(fid)}
                      className={["px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-colors",
                        fileTypes.includes(fid)
                          ? "bg-[var(--bg-nav)] text-white border-[var(--bg-nav)]"
                          : "border-gray-200 text-gray-500 hover:border-[var(--bg-nav)] hover:text-[var(--text-primary)]"
                      ].join(" ")}
                    >{label}</button>
                  ))}
                </div>
                {fileTypes.length === 0 && (
                  <p className="text-xs text-[var(--s-err-text)] mt-1.5">{t("เลือกประเภทไฟล์อย่างน้อย 1 ประเภท", "Select at least one file type")}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">{t("รูปแบบการส่งงาน", "Submission Type")}</label>
              <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
                {(["individual", "group"] as const).map((tp) => (
                  <button key={tp} type="button" onClick={() => handleSubmissionTypeChange(tp)}
                    className={["px-4 py-2 text-sm font-medium transition-colors",
                      submissionType === tp ? "bg-[var(--bg-nav)] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                    ].join(" ")}>
                    {tp === "individual" ? t("รายบุคคล", "Individual") : t("กลุ่ม", "Group")}
                  </button>
                ))}
              </div>
              {submissionType === "group" && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm text-gray-500">{t("สมาชิกต่อกลุ่มสูงสุด", "Max members per group")}</label>
                  <input
                    type="number" min="2" max="20"
                    value={maxGroupSize} onChange={e => setMaxGroupSize(e.target.value)}
                    placeholder="4"
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                  <span className="text-sm text-gray-500">{t("คน", "members")}</span>
                </div>
              )}
            </div>
          </section>

          {/* Rubric section */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("เกณฑ์การให้คะแนน (Rubric)", "Grading Rubric")}</h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowNewRubricForm(true); setNewRubricName(""); }}
                disabled={showNewRubricForm}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-xs font-medium hover:bg-teal-50 transition-colors disabled:opacity-40"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                {t("สร้างเกณฑ์ใหม่", "New Rubric")}
              </button>
            </div>

            {linkedRubrics.length === 0 && !showNewRubricForm ? (
              <div className="text-center py-6 text-xs text-gray-500">
                {t('ยังไม่มีเกณฑ์การให้คะแนน — กด "สร้างเกณฑ์ใหม่" เพื่อเพิ่ม', 'No rubrics yet — click "New Rubric" to add one')}
              </div>
            ) : (
              <div className="space-y-2">
                {linkedRubrics.map(rubric => (
                  <div key={rubric.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{rubric.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rubric.criteria.length > 0
                            ? `${rubric.criteria.length} ${t("เกณฑ์ย่อย", "criteria")} · ${rubric.criteria.reduce((s, c) => s + c.maxPoints, 0)} ${t("คะแนนรวม", "total pts")}`
                            : t("ยังไม่มีเกณฑ์ย่อย — เปิด Rubric Editor เพื่อเพิ่ม", "No criteria yet — open Rubric Editor to add")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/teacher/courses/${id}/assignments/${assignmentId}/rubrics/${rubric.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-[var(--accent)] border border-[var(--accent)] hover:bg-teal-50 transition-colors font-medium"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        {t("แก้ไข Rubric", "Edit Rubric")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteRubric(rubric.id, rubric.name)}
                        className="p-1.5 rounded-lg hover:bg-[var(--s-err-bg)] text-gray-500 hover:text-[var(--s-err-text)] transition-colors"
                        title={t("ลบเกณฑ์", "Delete rubric")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showNewRubricForm && (
              <div className="mt-3 p-4 rounded-xl bg-teal-50/50 border border-[var(--accent)]/20">
                <label className="block text-xs font-medium text-gray-500 mb-2">{t("ชื่อเกณฑ์", "Rubric Name")}</label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newRubricName}
                    onChange={e => setNewRubricName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddRubric(); }
                      if (e.key === "Escape") { setShowNewRubricForm(false); setNewRubricName(""); }
                    }}
                    placeholder={t("เช่น เกณฑ์การวิจัยผู้ใช้", "e.g. User Research Rubric")}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                  <button type="button" onClick={handleAddRubric} disabled={!newRubricName.trim()}
                    className="px-3 py-2 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-medium hover:bg-[#14B8A6] disabled:opacity-40 transition-colors">
                    {t("บันทึก", "Save")}
                  </button>
                  <button type="button" onClick={() => { setShowNewRubricForm(false); setNewRubricName(""); }}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                    {t("ยกเลิก", "Cancel")}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Danger Zone */}
          <section className="bg-white rounded-2xl border border-[var(--s-err-bd)] shadow-sm p-6">
            <h2 className="text-sm font-semibold text-[var(--s-err-text)] uppercase tracking-wider mb-4">{t("โซนอันตราย", "Danger Zone")}</h2>
            <button
              type="button" onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--s-err-bd)] text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
            >
              {t("ลบชิ้นงาน", "Delete Assignment")}
            </button>
            <p className="text-xs text-gray-500 mt-3">
              {t("การลบชิ้นงานจะลบข้อมูลการส่งและผลการตรวจทั้งหมด ไม่สามารถกู้คืนได้", "Deleting this assignment removes all submission and grading data permanently.")}
            </p>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button type="button" onClick={() => navAway(`/teacher/courses/${id}/assignments/${assignmentId}`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit" disabled={!isValid}
              className={["flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                saved ? "bg-emerald-500 text-white" : "bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] disabled:opacity-40 disabled:cursor-not-allowed"
              ].join(" ")}
            >
              {saved ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{t("บันทึกแล้ว", "Saved")}</>
              ) : t("บันทึกการเปลี่ยนแปลง", "Save Changes")}
            </button>
          </div>
        </form>
      </main>
  );
}

function SectionHeader({ icon, label }: { icon: "info" | "doc" | "cal" | "upload"; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {icon === "info" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )}
      {icon === "doc" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
        </svg>
      )}
      {icon === "cal" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
      {icon === "upload" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      )}
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
    </div>
  );
}
