"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

export default function NewAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { addAssignment } = useAssignments();

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

  const course = getCourse(id);
  const todayStr = new Date().toISOString().split("T")[0];

  const isDirty =
    name.trim() !== "" || description.trim() !== "" || dueDate !== "" || maxPoints !== "100" ||
    submissionType !== "individual" || maxGroupSize !== "";

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
    const a = addAssignment({
      courseId: id,
      name: name.trim(),
      description: description.trim(),
      dueDate,
      maxPoints: parseInt(maxPoints) || 100,
      acceptsFiles,
      fileTypes: acceptsFiles ? fileTypes : [],
      submissionType,
      maxGroupSize: submissionType === "group" && maxGroupSize ? parseInt(maxGroupSize) : null,
      rubricIds: [],
    });
    router.push(`/teacher/courses/${id}/assignments/${a.id}`);
  }

  const isValid = name.trim().length > 0 && dueDate !== "" && (!acceptsFiles || fileTypes.length > 0);

  return (
      <main className="w-full max-w-[700px] mx-auto px-8 py-10">

        <button
          onClick={() => navAway(`/teacher/courses/${id}/assignments`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[var(--accent)] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t("กลับรายการชิ้นงาน", "Back to assignments")}
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("สร้างชิ้นงานใหม่", "New Assignment")}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {t("สร้างชิ้นงานในวิชา", "Create an assignment in")}{" "}
          <span className="font-semibold text-[var(--text-primary)]">{course?.name ?? "..."}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="info" label={t("ข้อมูลทั่วไป", "General Information")} />
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t("ชื่อชิ้นงาน", "Assignment Name")} <span className="text-red-400">*</span>
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
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <SectionHeader icon="cal" label={t("กำหนดเวลาและคะแนน", "Deadline & Score")} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t("วันครบกำหนด", "Due Date")} <span className="text-red-400">*</span>
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
                        maxPoints === String(p) ? "bg-[#2DD4BF] text-[var(--text-primary)] border-[var(--accent)]" : "border-gray-200 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  acceptsFiles ? "bg-[#2DD4BF]" : "bg-gray-200",
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
                  <p className="text-xs text-red-400 mt-1.5">{t("เลือกประเภทไฟล์อย่างน้อย 1 ประเภท", "Select at least one file type")}</p>
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

          {/* Rubric note */}
          <div className="flex gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <svg className="shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>{t("เกณฑ์การให้คะแนน (Rubric)", "Grading Rubric")}</strong> —{" "}
              {t(
                "สามารถเพิ่มและจัดการ Rubric ได้ในหน้าแก้ไขชิ้นงาน หลังจากบันทึกชิ้นงานนี้แล้ว",
                "You can add and manage rubrics on the assignment edit page after saving."
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
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
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2DD4BF] hover:bg-[#14B8A6] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    doc: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
    ),
    cal: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    upload: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
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
