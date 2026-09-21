"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";
import { AttachmentsEditor, useAttachmentsDraft } from "@/components/AssignmentAttachments";
import RubricCriteriaEditor, { CriterionDraft, newCriterionDraft, criteriaWeightOk, finalizeCriteria } from "@/components/RubricCriteriaEditor";

export default function NewAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { addAssignment, addRubric, updateAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const CONFIRM_MSG = t(
    "ข้อมูลที่กรอกจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?",
    "Your input will not be saved.\nLeave this page?"
  );

  const FILE_TYPE_OPTIONS: { id: Assignment["fileTypes"][number]; label: string }[] = [
    { id: "figma", label: "Figma" },
    { id: "pdf", label: "PDF" },
    { id: "image", label: t("รูปภาพ", "Image") },
  ];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [acceptsFiles, setAcceptsFiles] = useState(true);
  const [fileTypes, setFileTypes] = useState<Assignment["fileTypes"]>(["figma", "pdf"]);
  const [submissionType, setSubmissionType] = useState<"individual" | "group">("individual");
  const [maxGroupSize, setMaxGroupSize] = useState<string>("");
  const [categoryId, setCategoryId] = useState("");
  const att = useAttachmentsDraft();
  // Rubric lives on this page now (was a separate step after creating). Start with one
  // criterion worth 100% so a fresh form is already a valid rubric; the teacher splits it up.
  const [criteria, setCriteria] = useState<CriterionDraft[]>(() => [newCriterionDraft(t("เกณฑ์ที่ 1", "Criterion 1"), "100")]);
  const [initialCriteriaJson] = useState(() => JSON.stringify(criteria));
  const [rubricTouched, setRubricTouched] = useState(false);

  const course = getCourse(id);
  const categories = getCategoriesByCourse(id);
  const todayStr = new Date().toISOString().split("T")[0];

  const isDirty =
    name.trim() !== "" || description.trim() !== "" || dueDate !== "" || maxPoints !== "100" ||
    submissionType !== "individual" || maxGroupSize !== "" || att.items.length > 0 ||
    (rubricTouched && JSON.stringify(criteria) !== initialCriteriaJson);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const points = parseInt(maxPoints) || 100;
    const a = addAssignment({
      courseId: id,
      name: name.trim(),
      description: description.trim(),
      attachments: att.items.length > 0 ? att.items : undefined,
      dueDate,
      maxPoints: points,
      categoryId: categoryId || undefined,
      acceptsFiles,
      fileTypes: acceptsFiles ? fileTypes : [],
      submissionType,
      maxGroupSize: submissionType === "group" && maxGroupSize ? parseInt(maxGroupSize) : null,
      rubricIds: [],
    });
    const rubric = addRubric({
      assignmentId: a.id,
      name: t("เกณฑ์การให้คะแนน", "Grading Rubric"),
      criteria: finalizeCriteria(criteria, points, t("ไม่มีชื่อ", "Untitled")),
    });
    updateAssignment(a.id, { rubricIds: [rubric.id] });
    att.commit();
    router.push(`/teacher/courses/${id}/assignments/${a.id}`);
  }

  const weightOk = criteriaWeightOk(criteria);
  const isValid = name.trim().length > 0 && dueDate !== "" && (!acceptsFiles || fileTypes.length > 0) && weightOk;

  return (
      <main className="w-full px-8 py-8">

        {/* Breadcrumb (same pattern as the other course pages) */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
          <button type="button" onClick={() => navAway("/teacher/courses")} aria-label={t("วิชาทั้งหมด", "All Courses")} className="hover:text-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <span>/</span>
          <button type="button" onClick={() => navAway(`/teacher/courses/${id}`)} className="hover:text-[var(--accent)] transition-colors">{course?.name ?? "..."}</button>
          <span>/</span>
          <button type="button" onClick={() => navAway(`/teacher/courses/${id}/assignments`)} className="hover:text-[var(--accent)] transition-colors">{t("ชิ้นงาน", "Assignments")}</button>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("สร้างชิ้นงานใหม่", "New Assignment")}</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("สร้างชิ้นงานใหม่", "New Assignment")}</h1>
        <p className="text-sm text-gray-500 mt-1.5 mb-8">
          {t("สร้างชิ้นงานและตั้งเกณฑ์การให้คะแนนในวิชา", "Create an assignment and set its grading rubric in")}{" "}
          <span className="font-semibold text-[var(--text-primary)]">{course?.name ?? "..."}</span>
        </p>

        {/* Enter inside a text field must not submit the whole form (rubric fields live here too) */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">

          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="info" label={t("ข้อมูลทั่วไป", "General Information")} />
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t("ชื่อชิ้นงาน", "Assignment Name")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("เช่น รายงานการวิจัยผู้ใช้", "e.g. User Research Report")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              required
            />
          </section>

          {/* Description */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="doc" label={t("รายละเอียดชิ้นงาน", "Description")} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("อธิบายวัตถุประสงค์ รูปแบบไฟล์ที่ต้องส่ง เกณฑ์เบื้องต้น ฯลฯ", "Describe the objectives, file format, grading criteria, etc.")}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
            />
            <AttachmentsEditor items={att.items} onChange={att.setItems} />
          </section>

          </div>
          <div className="space-y-5">

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
                    type="date" value={dueDate} min={todayStr}
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

            {categories.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t("หมวดงาน (สัดส่วนคะแนน)", "Grading Category")}</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                >
                  <option value="">{t("ไม่ระบุ", "None")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>
                  ))}
                </select>
              </div>
            )}
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
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  acceptsFiles ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]",
                ].join(" ")}
              >
                <span className={[
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  acceptsFiles ? "translate-x-6" : "translate-x-1",
                ].join(" ")} />
              </button>
            </div>

            {acceptsFiles && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-500 mb-2">{t("ประเภทไฟล์ที่รับ", "Accepted File Types")}</label>
                <div className="flex gap-2">
                  {FILE_TYPE_OPTIONS.map(({ id: fid, label }) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => toggleFileType(fid)}
                      className={[
                        "px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-colors",
                        fileTypes.includes(fid)
                          ? "bg-[var(--bg-nav)] text-white border-[var(--bg-nav)]"
                          : "border-gray-200 text-gray-500 hover:border-[var(--bg-nav)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
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
                  <button
                    key={tp}
                    type="button"
                    onClick={() => handleSubmissionTypeChange(tp)}
                    className={[
                      "px-4 py-2 text-sm font-medium transition-colors",
                      submissionType === tp
                        ? "bg-[var(--bg-nav)] text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {tp === "individual" ? t("รายบุคคล", "Individual") : t("กลุ่ม", "Group")}
                  </button>
                ))}
              </div>

              {submissionType === "group" && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-sm text-gray-500">{t("สมาชิกต่อกลุ่มสูงสุด", "Max members per group")}</label>
                  <input
                    type="number" min="2" max="20"
                    value={maxGroupSize}
                    onChange={e => setMaxGroupSize(e.target.value)}
                    placeholder="4"
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                  <span className="text-sm text-gray-500">{t("คน", "members")}</span>
                </div>
              )}
            </div>
          </section>

          </div>
          </div>

          {/* Rubric */}
          <section className="mt-8" aria-labelledby="rubric-heading">
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <h2 id="rubric-heading" className="text-base font-semibold text-[var(--text-primary)]">{t("เกณฑ์การให้คะแนน (Rubric)", "Grading Rubric")}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              {t("ตั้งเกณฑ์ที่ HWAI Agent จะใช้ตรวจงานนี้ น้ำหนักรวมต้องได้ 100%", "Set the criteria the HWAI Agent will grade this assignment with. Weights must total 100%.")}
            </p>
            <RubricCriteriaEditor
              criteria={criteria}
              setCriteria={(u) => { setRubricTouched(true); setCriteria(u); }}
              maxPoints={parseInt(maxPoints) || 100}
              assignmentName={name.trim()}
            />
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 pb-4 border-t border-gray-100">
            {!weightOk && (
              <span className="text-xs text-amber-600 mr-auto">{t("น้ำหนักเกณฑ์รวมต้องเท่ากับ 100% ก่อนสร้างชิ้นงาน", "Rubric weights must total 100% before you can create the assignment")}</span>
            )}
            <button
              type="button"
              onClick={() => navAway(`/teacher/courses/${id}/assignments`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--accent-solid-text)] text-sm font-medium rounded-xl transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              {t("สร้างชิ้นงาน", "Create Assignment")}
            </button>
          </div>
        </form>
      </main>
  );
}

function SectionHeader({ icon, label }: { icon: "info" | "doc" | "cal" | "upload"; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    info: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    doc: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
    ),
    cal: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    upload: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  };
  return (
    <div className="flex items-center gap-2 mb-5">
      {icons[icon]}
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
    </div>
  );
}
