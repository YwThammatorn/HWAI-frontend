"use client";

// Assign work to TAs (10/11/2569, advisor R28): the teacher gives each TA of the course whole assignments to grade. The TA then works only with those
// (lib/useGradableAssignments.ts); this page also shows each TA's progress — pieces waiting and graded. The first version of this route, a split by
// week / team / hand-picked submissions, is kept in archive/grading-split/.

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useSectionRoles } from "@/lib/section-roles";
import { useCohortStudents } from "@/lib/cohort-students";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCurrentAccountId } from "@/lib/current-account";
import { useAssignments, type Assignment } from "@/lib/assignments";
import { useStudents, withdrawnIds } from "@/lib/students";
import { useGradingAssignments } from "@/lib/grading-assignments";
import { isEnrolledInSubjectThatTerm } from "@/lib/taAccess";
import { assignedAssignmentIds, queueFigures } from "@/lib/taWork";
import { useLanguage } from "@/context/LanguageContext";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface TaRow { accountId: string; name: string; studentId: string }

// ─── Pick the assignments of one TA (centred popup) ──────────────────────────────────────

function AssignWorkModal({ ta, assignments, selected, onSave, onClose }: {
  ta: TaRow;
  assignments: Assignment[];
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = assignments.length > 0 && assignments.every((a) => picked.has(a.id));
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t(`มอบหมายงานให้ ${ta.name}`, `Assign work to ${ta.name}`)}
      description={t("ผู้ช่วยสอนจะเห็นและตรวจได้เฉพาะงานที่เลือกไว้ที่นี่", "The TA sees and grades only the assignments ticked here")}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            type="button"
            data-testid="assign-save"
            onClick={() => onSave([...picked])}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {t("บันทึก", "Save")}
          </button>
        </>
      }
    >
      {assignments.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t("วิชานี้ยังไม่มีงาน", "This course has no assignments yet")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <input
              type="checkbox"
              data-testid="assign-all"
              checked={allOn}
              onChange={() => setPicked(allOn ? new Set() : new Set(assignments.map((a) => a.id)))}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t("เลือกทั้งหมด", "Select all")}
            <span className="ml-auto text-xs font-medium tabular-nums text-[var(--text-muted)]">{t(`เลือกแล้ว ${picked.size} จาก ${assignments.length}`, `${picked.size} of ${assignments.length} ticked`)}</span>
          </label>
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {assignments.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--bg-subtle)] transition-colors">
                  <input type="checkbox" data-testid={`assign-${a.id}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{a.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{a.maxPoints} {t("คะแนน", "pts")}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssignWorkPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse, courses: allCourses } = useCourses();
  const { cohortStudents } = useCohortStudents();
  const { getTeachersByCourse } = useManagedTeachers();
  const { getRolesBySection, hasPermission } = useSectionRoles();
  const { gradingAssignments, addGradingAssignment, updateGradingAssignment, removeGradingAssignment } = useGradingAssignments();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { students: allEnrollments, getStudentsByCourse } = useStudents();
  const currentAccountId = useCurrentAccountId();
  const course = getCourse(id);
  // Same rule as the Collaborators page: the primary teacher (admin-assigned) or a role with the right to edit settings; fail open for an unresolved session.
  const isPrimaryTeacher = course ? getTeachersByCourse(course.id).some((tc) => tc.id === currentAccountId) : false;
  const canManage = course ? (currentAccountId === null || isPrimaryTeacher || hasPermission(currentAccountId, course.id, "canEditSettings")) : true;

  const [editing, setEditing] = useState<TaRow | null>(null);

  const assignments = useMemo(() => (course ? [...getAssignmentsByCourse(course.id)].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) : []), [course, getAssignmentsByCourse]);

  // the course's TAs: appointed on Collaborators and not enrolled in this subject this term (the same rule that gives them the TA hat)
  const tas = useMemo<TaRow[]>(() => {
    if (!course) return [];
    return getRolesBySection(course.id)
      .filter((r) => r.role === "ta")
      .map((r): TaRow | null => {
        const s = cohortStudents.find((c) => c.id === r.accountId);
        if (!s || isEnrolledInSubjectThatTerm(s.studentId, course, allCourses, allEnrollments)) return null;
        return { accountId: s.id, name: `${s.firstName} ${s.lastName}`, studentId: s.studentId };
      })
      .filter((x): x is TaRow => x !== null);
  }, [course, getRolesBySection, cohortStudents, allCourses, allEnrollments]);

  const withdrawn = useMemo(() => (course ? withdrawnIds(getStudentsByCourse(course.id)) : new Set<string>()), [course, getStudentsByCourse]);
  const liveSubs = (assignmentId: string) => getSubmissionsByAssignment(assignmentId).filter((s) => !withdrawn.has(s.studentId));

  function save(ta: TaRow, ids: string[]) {
    if (!course) return;
    const mine = gradingAssignments.filter((g) => g.courseId === course.id && g.taAccountId === ta.accountId && g.scope.type === "assignments");
    if (ids.length === 0) mine.forEach((g) => removeGradingAssignment(g.id));
    else if (mine.length > 0) {
      updateGradingAssignment(mine[0].id, { scope: { type: "assignments", assignmentIds: ids } });
      mine.slice(1).forEach((g) => removeGradingAssignment(g.id));
    } else addGradingAssignment({ courseId: course.id, taAccountId: ta.accountId, scope: { type: "assignments", assignmentIds: ids } });
    setEditing(null);
  }

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
        <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
      </main>
    );
  }

  return (
    <main className="w-full px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("มอบหมายงานให้ TA", "Assign work to TAs")}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("มอบหมายงานให้ TA", "Assign work to TAs")}</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {t("เลือกงานที่ผู้ช่วยสอนแต่ละคนต้องตรวจใน", "Choose the assignments each TA grades in")} <strong className="text-[var(--text-primary)]">{course.name}</strong>
          {" — "}{t("ผู้ช่วยสอนจะเห็นเฉพาะงานเหล่านั้นในคิวของตัวเอง", "a TA sees only those in their own queue")}
        </p>
      </div>

      {tas.length === 0 ? (
        <EmptyState
          icon="users"
          title={t("วิชานี้ยังไม่มีผู้ช่วยสอน", "This course has no TAs yet")}
          description={t("แต่งตั้งนักศึกษาเป็นผู้ช่วยสอนที่หน้าผู้ร่วมสอนก่อน", "Appoint a student as a TA on the Collaborators page first")}
          action={<Link href={`/teacher/courses/${id}/collaborators`} className="inline-flex h-10 items-center rounded-xl bg-[var(--accent-solid)] px-4 text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ไปหน้าผู้ร่วมสอน", "Go to Collaborators")}</Link>}
        />
      ) : (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ผู้ช่วยสอน", "TA")}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("งานที่มอบหมาย", "Assigned work")}</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รอตรวจ", "Waiting")}</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ตรวจแล้ว", "Graded")}</th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("การดำเนินการ", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {tas.map((ta) => {
                const ids = assignedAssignmentIds(gradingAssignments, course.id, ta.accountId);
                const mine = assignments.filter((a) => ids.has(a.id));
                const q = queueFigures(mine, liveSubs);
                return (
                  <tr key={ta.accountId} data-testid={`ta-row-${ta.studentId}`}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar size="md" initials={initialsOf(ta.name)} bg="var(--role-ta-text)" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{ta.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{ta.studentId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[420px]">
                      {mine.length === 0 ? (
                        <span data-testid="no-work" className="text-xs text-[var(--text-muted)]">{t("ยังไม่ได้มอบหมายงาน", "No work assigned yet")}</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5" aria-label={t("งานที่มอบหมาย", "Assigned work")}>
                          {mine.map((a) => (
                            <li key={a.id} className="inline-flex h-6 max-w-[180px] items-center truncate rounded-md border border-[var(--role-ta-border)] bg-[var(--role-ta-bg)] px-2 text-xs font-semibold text-[var(--role-ta-text)]">{a.name}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td data-testid="ta-waiting" className="px-4 py-3.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">{q.waiting}</td>
                    <td data-testid="ta-graded" className="px-4 py-3.5 text-right font-semibold tabular-nums text-[var(--text-primary)]">{q.graded}</td>
                    <td className="px-4 py-3.5 text-right">
                      {canManage ? (
                        <button
                          type="button"
                          data-testid={`assign-open-${ta.studentId}`}
                          onClick={() => setEditing(ta)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                        >
                          <Icon name="edit" />
                          {mine.length === 0 ? t("มอบหมายงาน", "Assign work") : t("แก้ไข", "Edit")}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AssignWorkModal
          ta={editing}
          assignments={assignments}
          selected={[...assignedAssignmentIds(gradingAssignments, course.id, editing.accountId)]}
          onSave={(ids) => save(editing, ids)}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
