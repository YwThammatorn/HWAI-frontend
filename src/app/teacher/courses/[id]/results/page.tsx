"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

function gradeLetter(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradeClass(letter: string): string {
  return (
    { A: "bg-green-100 text-green-700", B: "bg-blue-100 text-blue-700", C: "bg-yellow-100 text-yellow-700",
      D: "bg-orange-100 text-orange-700", F: "bg-[var(--s-err-bg)] text-[var(--s-err-text)]" }[letter] ?? "bg-gray-100 text-gray-500"
  );
}

export default function CourseResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();

  const course = getCourse(id);
  const assignments = getAssignmentsByCourse(id);

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบรายวิชา", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
        </main>
    );
  }

  return (
      <main className="w-full max-w-[900px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชา", "Courses")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{t("ผลลัพธ์", "Results")}</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ผลการตรวจงาน", "Grading Results")}</h1>
        <p className="text-sm text-gray-400 mb-8">{course.name}</p>

        {assignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">{t("ยังไม่มีชิ้นงาน", "No assignments yet")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("สร้างชิ้นงานก่อนเพื่อดูผลลัพธ์", "Create assignments first to view results")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const subs = getSubmissionsByAssignment(a.id);
              const total = subs.length;
              const graded = subs.filter((s) => s.status === "graded").length;
              const needsReview = subs.filter((s) => s.status === "need_review").length;
              const scored = subs.filter((s) => s.aiScore !== null || s.instructorScore !== null);
              const avg =
                scored.length > 0
                  ? scored.reduce((sum, s) => sum + (s.instructorScore ?? s.aiScore ?? 0), 0) / scored.length
                  : null;
              const avgLetter = avg !== null ? gradeLetter(avg, a.maxPoints) : null;
              const allDone = total > 0 && graded === total;

              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{a.name}</h3>
                      {total === 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium shrink-0">
                          {t("ยังไม่มีงานส่ง", "No submissions")}
                        </span>
                      ) : allDone ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                          {t("เสร็จสิ้น", "Complete")}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                          {t("กำลังดำเนินการ", "In Progress")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{graded}/{total} {t("ตรวจแล้ว", "graded")}</span>
                      {needsReview > 0 && (
                        <span className="text-amber-600">{needsReview} {t("รอตรวจสอบ", "needs review")}</span>
                      )}
                      {avg !== null && avgLetter && (
                        <span>
                          {t("เฉลี่ย:", "Avg:")}{" "}
                          <span className="font-semibold text-[var(--text-primary)]">{avg.toFixed(1)}</span>
                          {" "}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeClass(avgLetter)}`}
                          >
                            {avgLetter}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {total > 0 && (
                      <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0F766E] transition-all"
                          style={{ width: `${(graded / total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {total === 0 ? null : allDone ? (
                      <Link
                        href={`/teacher/courses/${id}/assignments/${a.id}/results`}
                        className="px-3 py-2 rounded-lg bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-semibold transition-colors"
                      >
                        {t("ดูผลลัพธ์", "View Results")}
                      </Link>
                    ) : (
                      <Link
                        href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        {t("ดูความคืบหน้า", "View Progress")}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
  );
}
