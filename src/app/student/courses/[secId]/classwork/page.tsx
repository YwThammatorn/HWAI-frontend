"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment, Submission } from "@/lib/assignments";

// ── Status helper ──────────────────────────────────────────────────────────

type WorkStatus = "not_submitted" | "submitted" | "graded" | "late";

function getWorkStatus(
  assignment: Assignment,
  submission: Submission | undefined
): WorkStatus {
  if (!submission) {
    const due = new Date(assignment.dueDate + "T23:59:59");
    return new Date() > due ? "late" : "not_submitted";
  }
  if (submission.status === "graded") return "graded";
  return "submitted";
}

const STATUS_CONFIG: Record<WorkStatus, { label: string; labelEn: string; cls: string }> = {
  not_submitted: { label: "ยังไม่ส่ง", labelEn: "Not submitted", cls: "bg-blue-50 text-blue-700" },
  submitted: { label: "ส่งแล้ว", labelEn: "Submitted", cls: "bg-gray-100 text-gray-600" },
  graded: { label: "มีคะแนนแล้ว", labelEn: "Graded", cls: "bg-green-50 text-green-700" },
  late: { label: "เกินกำหนด", labelEn: "Late", cls: "bg-[var(--s-err-bg)] text-[var(--s-err-text)]" },
};

// ── Assignment card ────────────────────────────────────────────────────────

function ClassworkCard({
  assignment,
  submission,
  courseId,
}: {
  assignment: Assignment;
  submission: Submission | undefined;
  courseId: string;
}) {
  const { t } = useLanguage();
  const status = getWorkStatus(assignment, submission);
  const config = STATUS_CONFIG[status];
  const due = new Date(assignment.dueDate + "T23:59:59");
  const hoursLeft = (due.getTime() - Date.now()) / 3_600_000;
  const isUrgent = hoursLeft > 0 && hoursLeft < 24;

  const score = submission?.instructorScore ?? submission?.aiScore ?? null;

  return (
    <Link
      href={`/student/courses/${courseId}/classwork/${assignment.id}`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:shadow-sm hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
    >
      {/* Left icon */}
      <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{assignment.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">
            {t("กำหนดส่ง:", "Due:")} {" "}
            <span className={isUrgent ? "font-semibold text-[var(--s-err-text)]" : ""}>
              {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </span>
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            assignment.submissionType === "group"
              ? "bg-purple-50 text-purple-700"
              : "bg-[#F97316]/10 text-[#C2410C]"
          }`}>
            {assignment.submissionType === "group" ? t("กลุ่ม", "Group") : t("เดี่ยว", "Individual")}
          </span>
          {isUrgent && (
            <span className="text-[10px] font-bold text-[var(--s-err-text)] bg-[var(--s-err-bg)] px-2 py-0.5 rounded-full">
              {t("ใกล้ครบกำหนด!", "Due soon!")}
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {score !== null ? (
          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
            {score}<span className="text-xs font-normal text-[var(--text-muted)]">/{assignment.maxPoints}</span>
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีคะแนน", "No score yet")}</p>
        )}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.cls}`}>
          {t(config.label, config.labelEn)}
        </span>
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function StudentClassworkPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();

  const course = getCourse(secId);
  const assignments = getAssignmentsByCourse(secId);

  const mySubmissions = useMemo(() => {
    const map = new Map<string, Submission>();
    assignments.forEach((a) => {
      const sub = getSubmissionsByAssignment(a.id).find(
        (s) => s.studentId === (user?.studentId ?? user?.email ?? "")
      );
      if (sub) map.set(a.id, sub);
    });
    return map;
  }, [assignments, getSubmissionsByAssignment, user]);

  const today = new Date().toISOString().split("T")[0];
  const dueToday = assignments.filter((a) => a.dueDate === today);
  const allOther = assignments.filter((a) => a.dueDate !== today);

  if (!course) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t("ไม่พบรายวิชา", "Course not found")}</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
        {/* Course banner */}
        <div
          className="rounded-2xl p-5 mb-6 flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${course.coverColor}33, ${course.coverColor}22)`, borderLeft: `4px solid ${course.coverColor}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: course.coverColor }}
            aria-hidden="true"
          >
            {course.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{course.name}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {t(`${assignments.length} งานทั้งหมด`, `${assignments.length} assignment(s) total`)}
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F97316]/10 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีงาน", "No assignments yet")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Due today */}
            {dueToday.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--s-err-text)] mb-3">
                  {t(`ส่งวันนี้ (${dueToday.length})`, `Due today (${dueToday.length})`)}
                </h2>
                <div className="flex flex-col gap-2">
                  {dueToday.map((a) => (
                    <ClassworkCard
                      key={a.id}
                      assignment={a}
                      submission={mySubmissions.get(a.id)}
                      courseId={secId}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All assignments */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t("งานทั้งหมด", "All Assignments")}
              </h2>
              <div className="flex flex-col gap-2">
                {(dueToday.length > 0 ? allOther : assignments).map((a) => (
                  <ClassworkCard
                    key={a.id}
                    assignment={a}
                    submission={mySubmissions.get(a.id)}
                    courseId={secId}
                  />
                ))}
                {dueToday.length > 0 && allOther.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีงานอื่น", "No other assignments")}</p>
                )}
              </div>
            </section>
          </div>
        )}
    </div>
  );
}
