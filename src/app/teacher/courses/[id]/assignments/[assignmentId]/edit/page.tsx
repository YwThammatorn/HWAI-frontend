"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";
import { AttachmentsEditor, useAttachmentsDraft } from "@/components/AssignmentAttachments";
import RubricCriteriaEditor, { CriterionDraft, newCriterionDraft, toDraft, criteriaPointsOk, criteriaTotalPoints, finalizeCriteria } from "@/components/RubricCriteriaEditor";

export default function EditAssignmentPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const {
    getAssignment, updateAssignment, removeAssignment,
    getRubricsByAssignment, addRubric, updateRubric,
  } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

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
  const categories = getCategoriesByCourse(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isExam, setIsExam] = useState(false);
  const [maxPoints, setMaxPoints] = useState("100");
  const [categoryId, setCategoryId] = useState("");
  const [acceptsFiles, setAcceptsFiles] = useState(true);
  const [fileTypes, setFileTypes] = useState<Assignment["fileTypes"]>(["figma", "pdf"]);
  const [submissionType, setSubmissionType] = useState<"individual" | "group">("individual");
  const [maxGroupSize, setMaxGroupSize] = useState("");
  const [saved, setSaved] = useState(false);
  const att = useAttachmentsDraft();

  // Rubric editing lives on this page now (23/9/2569 round 3, was a separate step via the
  // standalone rubrics/[rubricId] route — mirrors how New Assignment already does it inline).
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);

  const origRef = useRef({
    name: "", description: "", dueDate: "", isExam: false, maxPoints: "", categoryId: "",
    acceptsFiles: true, fileTypesJson: "[]",
    submissionType: "individual" as "individual" | "group",
    maxGroupSizeStr: "", criteriaJson: "[]",
  });

  useEffect(() => {
    if (assignment) {
      const ft = assignment.fileTypes ?? ["figma", "pdf"];
      const st = (assignment.submissionType ?? "individual") as "individual" | "group";
      const gs = assignment.maxGroupSize != null ? String(assignment.maxGroupSize) : "";
      // A rubric-less legacy/edge-case assignment (no rubric ever linked, or one with zero criteria —
      // no longer reachable via this page's own UI, but real pre-existing data can be in this state)
      // seeds one default criterion instead of an empty, permanently-invalid array — same fallback
      // New Assignment starts every fresh form with.
      const savedCriteria = (linkedRubrics[0]?.criteria ?? []).map(toDraft);
      const draftCriteria = savedCriteria.length > 0 ? savedCriteria : [newCriterionDraft(t("เกณฑ์ที่ 1", "Criterion 1"), "100")];
      const criteriaJson = JSON.stringify(draftCriteria);
      const orig = {
        name: assignment.name,
        description: assignment.description,
        dueDate: assignment.dueDate,
        isExam: assignment.isExam ?? false,
        maxPoints: String(assignment.maxPoints),
        categoryId: assignment.categoryId ?? "",
        acceptsFiles: assignment.acceptsFiles ?? true,
        fileTypesJson: JSON.stringify(ft),
        submissionType: st,
        maxGroupSizeStr: gs,
        criteriaJson,
      };
      setName(orig.name);
      setDescription(orig.description);
      setDueDate(orig.dueDate);
      setIsExam(orig.isExam);
      setMaxPoints(orig.maxPoints);
      setCategoryId(orig.categoryId);
      setAcceptsFiles(orig.acceptsFiles);
      setFileTypes(ft);
      setSubmissionType(st);
      setMaxGroupSize(gs);
      setCriteria(draftCriteria);
      att.reset(assignment.attachments ?? []);
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
      isExam !== origRef.current.isExam ||
      maxPoints !== origRef.current.maxPoints ||
      categoryId !== origRef.current.categoryId ||
      acceptsFiles !== origRef.current.acceptsFiles ||
      JSON.stringify(fileTypes) !== origRef.current.fileTypesJson ||
      submissionType !== origRef.current.submissionType ||
      maxGroupSize !== origRef.current.maxGroupSizeStr ||
      JSON.stringify(criteria) !== origRef.current.criteriaJson ||
      att.dirty
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
      attachments: att.items,
      dueDate,
      maxPoints: needsManualScore ? (parseInt(maxPoints) || 100) : criteriaTotalPoints(criteria),
      categoryId: categoryId || undefined,
      acceptsFiles,
      fileTypes: acceptsFiles ? fileTypes : [],
      submissionType,
      maxGroupSize: submissionType === "group" && maxGroupSize ? parseInt(maxGroupSize) : null,
      isExam,
    });
    if (!needsManualScore) {
      const finalized = finalizeCriteria(criteria, t("ไม่มีชื่อ", "Untitled"));
      if (linkedRubrics[0]) {
        updateRubric(linkedRubrics[0].id, { name: linkedRubrics[0].name, criteria: finalized });
      } else {
        // Edge case: a rubric-less legacy assignment gets one created on first save, same as New
        // Assignment does at creation time — there was nothing to link to before this.
        const rubric = addRubric({ assignmentId, name: t("เกณฑ์การให้คะแนน", "Grading Rubric"), criteria: finalized });
        updateAssignment(assignmentId, { rubricIds: [rubric.id] });
      }
    }
    att.commit();
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

  // Either toggle alone is enough to skip the rubric and enter a max score by hand (23/9/2569 round
  // 3) — same rule as New Assignment. Max Score's own live total now comes from local `criteria`
  // state directly (finalized + synced to the assignment on Save), not from the linked rubric's
  // last-saved value, since editing happens inline on this page now instead of a separate route.
  const needsManualScore = isExam || !acceptsFiles;
  const totalPoints = criteriaTotalPoints(criteria);
  const pointsOk = criteriaPointsOk(criteria);
  const isValid = name.trim().length > 0 && dueDate !== "" && (!acceptsFiles || fileTypes.length > 0) &&
    (needsManualScore ? (parseInt(maxPoints) || 0) > 0 : pointsOk);

  return (
      <main className="w-full px-8 py-8">

        {/* Breadcrumb (23/9/2569 round 4: replaced the old "Back to assignment" chevron button —
            same exact structure as New Assignment's, per the user's "ทำเหมือนหน้าตอน create" ask). */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
          <button type="button" onClick={() => navAway("/teacher/courses")} aria-label={t("วิชาทั้งหมด", "All Courses")} className="hover:text-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <span>/</span>
          <button type="button" onClick={() => navAway(`/teacher/courses/${id}`)} className="hover:text-[var(--accent)] transition-colors">{course?.name ?? "..."}</button>
          <span>/</span>
          <button type="button" onClick={() => navAway(`/teacher/courses/${id}/assignments`)} className="hover:text-[var(--accent)] transition-colors">{t("ชิ้นงาน", "Assignments")}</button>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("แก้ไขชิ้นงาน", "Edit Assignment")}</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("แก้ไขชิ้นงาน", "Edit Assignment")}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {t("กำลังแก้ไข", "Editing")}{" "}
          <span className="font-semibold text-[var(--text-primary)]">{assignment.name}</span>{" "}
          {t("ในวิชา", "in")} <span className="font-semibold text-[var(--text-primary)]">{course.name}</span>
        </p>

        {/* Enter inside a text field must not submit the whole form (rubric fields live here too),
            same guard as New Assignment. */}
        <form
          onSubmit={handleSave}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
        >
          {/* Column pairing (23/9/2569): matches New Assignment's own layout — General Info +
              Submission Settings on the left, Description + Deadline & Score on the right, not
              the "content vs. config" grouping it looks like. Submission Settings is the tallest
              card, General Info the shortest, so pairing them keeps both columns roughly the
              same total height instead of the old grouping, which left the right column taller. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">

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

          {/* Submission Settings */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="upload" label={t("การรับและรูปแบบงาน", "Submission Settings")} />

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("งานประเภทสอบ", "Exam Assignment")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("เปิดไว้เพื่อกำหนดคะแนนเต็มเอง — งานประเภทนี้ไม่ใช้ rubric", "Turn on to set the max score manually — no rubric is used for this type")}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsExam(v => !v)}
                aria-label={t("งานประเภทสอบ", "Exam Assignment")}
                aria-pressed={isExam}
                className={["relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", isExam ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]"].join(" ")}
              >
                <span className={["inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", isExam ? "translate-x-6" : "translate-x-1"].join(" ")} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("รับไฟล์จากนักศึกษา", "Accept Files")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("ปิดถ้างานนี้ไม่ต้องอัปโหลดไฟล์", "Disable if no upload needed")}</p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptsFiles(v => !v)}
                aria-label={t("รับไฟล์จากนักศึกษา", "Accept Files")}
                aria-pressed={acceptsFiles}
                className={["relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", acceptsFiles ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]"].join(" ")}
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

          </div>
          <div className="space-y-5">

          {/* Description */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="doc" label={t("รายละเอียดชิ้นงาน", "Description")} />
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] resize-none transition-colors"
            />
            <AttachmentsEditor items={att.items} onChange={att.setItems} />
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
                {needsManualScore ? (
                  <input
                    type="number" min="1" max="1000" value={maxPoints}
                    onChange={(e) => setMaxPoints(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                ) : (
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                    {t(`รวม ${totalPoints} คะแนน (จาก Rubric ด้านล่าง)`, `Total: ${totalPoints} pts (from the rubric below)`)}
                  </div>
                )}
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

          </div>
          </div>

          {/* Rubric — same plain (non-card) section style as New Assignment, full width below the
              2-column grid. Hidden for exam or no-file assignments, same as New. */}
          {!needsManualScore && (
            <section className="mt-8" aria-labelledby="rubric-heading">
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <h2 id="rubric-heading" className="text-base font-semibold text-[var(--text-primary)]">{t("เกณฑ์การให้คะแนน (Rubric)", "Grading Rubric")}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                {t("ตั้งเกณฑ์ที่ HWAI Agent จะใช้ตรวจงานนี้ พร้อมคะแนนของแต่ละเกณฑ์ — คะแนนเต็มของชิ้นงานจะมาจากผลรวมนี้", "Set the criteria the HWAI Agent will grade this assignment with, each with its own points. The assignment's max score is the sum.")}
              </p>
              <RubricCriteriaEditor
                criteria={criteria}
                setCriteria={setCriteria}
                assignmentName={name.trim()}
              />
            </section>
          )}

          {/* Danger Zone — New Assignment has no equivalent (nothing to delete yet); kept as its
              own full-width card, same mt-8 rhythm as the Rubric section above it. */}
          <section className="bg-white rounded-2xl border border-[var(--s-err-bd)] shadow-sm p-6 mt-8">
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

          {/* Actions — flex-wrap + basis-full (23/9/2569): a plain inline sibling next to the two
              buttons gets flex-shrunk down to almost nothing on a narrower viewport (see New
              Assignment's identical fix, same underlying pattern; same classes as New's own Actions row). */}
          <div className="flex flex-wrap items-center justify-end gap-3 mt-8 pt-6 pb-4 border-t border-gray-100">
            {!needsManualScore && !pointsOk && (
              <span className="text-xs text-amber-600 basis-full text-left">{t("ทุกเกณฑ์ต้องมีคะแนนมากกว่า 0 ก่อนบันทึก", "Every criterion needs more than 0 points before you can save")}</span>
            )}
            <button type="button" onClick={() => navAway(`/teacher/courses/${id}/assignments/${assignmentId}`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit" disabled={!isValid}
              className={["flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                saved ? "bg-emerald-500 text-white" : "bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] disabled:opacity-50 disabled:cursor-not-allowed"
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )}
      {icon === "doc" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
        </svg>
      )}
      {icon === "cal" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
      {icon === "upload" && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      )}
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
    </div>
  );
}
