"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCourses } from "@/lib/courses";
import { useSectionRoles, SectionRoleType, defaultPermissionsFor } from "@/lib/section-roles";
import { useCohortStudents } from "@/lib/cohort-students";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCurrentAccountId } from "@/lib/current-account";
import { useLanguage } from "@/context/LanguageContext";

// ─── Resolved-row shape (SectionRole joined against the account it points to) ──

interface TeamRow {
  key: string;
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
  roleLabel: string;
  roleBadgeColor: string;
  permissionSummary: string;
  removable: boolean;
  onRemove?: () => void;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ─── Components ───────────────────────────────────────────────────────────────

function Avatar({ initials, bg }: { initials: string; bg: string }) {
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ background: bg }}
    >
      {initials}
    </div>
  );
}

function RowMenu({ onRemove, label }: { onRemove: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
        aria-label={t("ตัวเลือกเพิ่มเติม", "More options")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg py-1 w-36">
          <button
            onClick={() => { onRemove(); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add collaborator drawer ────────────────────────────────────────────────────

function AddCollaboratorDrawer({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { sectionRoles, addSectionRole, removeSectionRole } = useSectionRoles();
  const { cohortStudents } = useCohortStudents();
  const { teachers, getTeachersByCourse } = useManagedTeachers();

  const [roleTab, setRoleTab] = useState<Exclude<SectionRoleType, "teacher">>("ta");
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, [roleTab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
  }

  const roleForCourse = sectionRoles.filter((r) => r.courseId === courseId);
  const primaryTeacherIds = new Set(getTeachersByCourse(courseId).map((tc) => tc.id));
  const existingTaIds = new Set(roleForCourse.filter((r) => r.role === "ta").map((r) => r.accountId));
  const existingCoTeacherIds = new Set(roleForCourse.filter((r) => r.role === "co-teacher").map((r) => r.accountId));

  const q = search.trim().toLowerCase();

  const taCandidates = cohortStudents.filter((s) => {
    if (existingTaIds.has(s.id)) return false;
    if (s.status === "inactive") return false;
    if (!q) return true;
    return (
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  const coTeacherCandidates = teachers.filter((tc) => {
    // Only teacher-role ManagedTeacher accounts can become a full-access
    // Co-Teacher here — a TA-role account should be added via the TA tab
    // (which carries restricted permissions), not granted full access by
    // picking it under the wrong tab.
    if (tc.role !== "teacher") return false;
    if (primaryTeacherIds.has(tc.id)) return false;
    if (existingCoTeacherIds.has(tc.id)) return false;
    if (tc.status === "inactive") return false;
    if (!q) return true;
    return tc.name.toLowerCase().includes(q) || tc.email.toLowerCase().includes(q);
  });

  function addTa(studentId: string) {
    addSectionRole({ accountId: studentId, courseId, role: "ta" });
  }
  function addCoTeacher(teacherId: string) {
    addSectionRole({ accountId: teacherId, courseId, role: "co-teacher" });
  }

  const alreadyAddedTa = cohortStudents.filter((s) => existingTaIds.has(s.id) && (!q ||
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)));
  const alreadyAddedCoTeacher = teachers.filter((tc) => existingCoTeacherIds.has(tc.id) && (!q ||
    tc.name.toLowerCase().includes(q) || tc.email.toLowerCase().includes(q)));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="add-collab-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="add-collab-title" className="text-base font-bold text-[var(--text-primary)]">
            {t("เพิ่มผู้ร่วมงาน", "Add Collaborator")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Role tabs */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setRoleTab("ta")}
            aria-pressed={roleTab === "ta"}
            className={`flex-1 h-9 rounded-xl border text-sm font-semibold transition-colors ${
              roleTab === "ta" ? "border-[var(--role-ta-border)] bg-[var(--role-ta-bg)] text-[var(--role-ta-text)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {t("ผู้ช่วยสอน (TA)", "Teaching Assistant")}
          </button>
          <button
            onClick={() => setRoleTab("co-teacher")}
            aria-pressed={roleTab === "co-teacher"}
            className={`flex-1 h-9 rounded-xl border text-sm font-semibold transition-colors ${
              roleTab === "co-teacher" ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/10 text-[var(--accent)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {t("อาจารย์ร่วมสอน", "Co-Teacher")}
          </button>
        </div>

        <p className="px-6 pt-2 text-[11px] text-[var(--text-muted)]">
          {roleTab === "ta"
            ? t("ผู้ช่วยสอนตรวจงานได้ แต่จัดการรายชื่อ/ตั้งค่าวิชาไม่ได้", "TAs can grade but cannot manage the roster or edit course settings")
            : t("อาจารย์ร่วมสอนมีสิทธิ์เต็มเหมือนอาจารย์ผู้สอนหลัก", "Co-teachers have full access, same as the primary teacher")}
        </p>

        {/* Search */}
        <div className="px-6 pt-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={roleTab === "ta" ? t("ค้นหาชื่อ/รหัสนักศึกษา/อีเมล", "Search name / student ID / email") : t("ค้นหาชื่อ/อีเมล", "Search name / email")}
              className="w-full h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-1">
          {roleTab === "ta" ? (
            <>
              {alreadyAddedTa.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--role-ta-bg)]">
                  <Avatar initials={initialsOf(`${s.firstName} ${s.lastName}`)} bg="#7C3AED" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.firstName} {s.lastName}</p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{s.studentId}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--role-ta-text)] shrink-0">{t("เพิ่มแล้ว", "Added")}</span>
                </div>
              ))}
              {taCandidates.length === 0 && alreadyAddedTa.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-6">{t("ไม่พบนักศึกษาที่ตรงกัน", "No matching students")}</p>
              ) : (
                taCandidates.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addTa(s.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-subtle)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >
                    <Avatar initials={initialsOf(`${s.firstName} ${s.lastName}`)} bg="#9CA3AF" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{s.studentId} · {s.email}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--text-muted)] shrink-0">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                ))
              )}
            </>
          ) : (
            <>
              {alreadyAddedCoTeacher.map((tc) => (
                <div key={tc.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--accent-bright)]/10">
                  <Avatar initials={initialsOf(tc.name)} bg="#0F766E" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tc.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{tc.email}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--accent)] shrink-0">{t("เพิ่มแล้ว", "Added")}</span>
                </div>
              ))}
              {coTeacherCandidates.length === 0 && alreadyAddedCoTeacher.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-6">{t("ไม่พบอาจารย์ที่ตรงกัน", "No matching teachers")}</p>
              ) : (
                coTeacherCandidates.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => addCoTeacher(tc.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-subtle)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >
                    <Avatar initials={initialsOf(tc.name)} bg="#9CA3AF" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tc.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{tc.email}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--text-muted)] shrink-0">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                ))
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] transition-colors">
            {t("เสร็จสิ้น", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollaboratorsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { sectionRoles, removeSectionRole, hasPermission } = useSectionRoles();
  const { cohortStudents } = useCohortStudents();
  const { teachers, getTeachersByCourse } = useManagedTeachers();
  const currentAccountId = useCurrentAccountId();
  const course = getCourse(id);
  // Fail open when the session can't be resolved to an account (e.g. a
  // dev-bypass login with no matching ManagedTeacher/CohortStudent row) —
  // this is a localStorage-only demo auth model, not a real backend, so an
  // unresolvable session shouldn't silently lock the screen down.
  const canManage = course ? (currentAccountId === null || hasPermission(currentAccountId, course.id, "canManageRoster")) : true;

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("CVD1FT");
  const [copied, setCopied] = useState(false);

  const rows: TeamRow[] = useMemo(() => {
    if (!course) return [];
    // getTeachersByCourse only reflects admin's course assignment (ManagedTeacher.courseIds)
    // and doesn't filter by ManagedTeacher.role — admin/courses.tsx lets a TA-role account
    // be assigned the same way as a teacher-role one. Reflect that honestly here rather than
    // blanket-labeling every admin-assigned account "Primary Teacher / Full access": a TA-role
    // account keeps its real TA label even when admin-assigned this way.
    const primary = getTeachersByCourse(course.id).map((tc): TeamRow => {
      const isTaRole = tc.role === "ta";
      return {
        key: `teacher-${tc.id}`,
        name: tc.name,
        email: tc.email,
        initials: initialsOf(tc.name),
        avatarBg: isTaRole ? "#7C3AED" : "#1B2A4A",
        roleLabel: isTaRole ? t("ผู้ช่วยสอน (Admin กำหนด)", "TA (Admin-assigned)") : t("อาจารย์ผู้สอน", "Primary Teacher"),
        roleBadgeColor: isTaRole ? "var(--role-ta-text)" : "var(--accent)",
        permissionSummary: isTaRole
          ? t("กำหนดโดยผู้ดูแลระบบ — จัดการที่นี่ไม่ได้", "Assigned by admin — not manageable here")
          : t("สิทธิ์เต็ม — กำหนดโดยผู้ดูแลระบบ", "Full access — assigned by admin"),
        removable: false,
      };
    });

    const roleRows = sectionRoles
      .filter((r) => r.courseId === course.id)
      .map((r): TeamRow | null => {
        const perms = r.permissions ?? defaultPermissionsFor(r.role);
        const permissionSummary = perms.canManageRoster && perms.canEditSettings
          ? t("สิทธิ์เต็ม", "Full access")
          : t("ตรวจงานได้ · จัดการรายชื่อ/ตั้งค่าไม่ได้", "Can grade only — no roster/settings access");

        if (r.role === "ta") {
          const student = cohortStudents.find((s) => s.id === r.accountId);
          if (!student) return null;
          return {
            key: `role-${r.id}`,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email,
            initials: initialsOf(`${student.firstName} ${student.lastName}`),
            avatarBg: "#7C3AED",
            roleLabel: t("ผู้ช่วยสอน", "Teaching Assistant"),
            roleBadgeColor: "var(--role-ta-text)",
            permissionSummary,
            removable: true,
            onRemove: () => removeSectionRole(r.id),
          };
        }
        // co-teacher — accountId points to a ManagedTeacher (not necessarily one
        // already in getTeachersByCourse, which only lists admin-assigned primaries)
        const teacher = teachers.find((tc) => tc.id === r.accountId);
        if (!teacher) return null; // orphaned — the ManagedTeacher was removed elsewhere
        return {
          key: `role-${r.id}`,
          name: teacher.name,
          email: teacher.email,
          initials: initialsOf(teacher.name),
          avatarBg: "#0F766E",
          roleLabel: t("อาจารย์ร่วมสอน", "Co-Teacher"),
          roleBadgeColor: "var(--accent)",
          permissionSummary,
          removable: true,
          onRemove: () => removeSectionRole(r.id),
        };
      })
      .filter((r): r is TeamRow => r !== null);

    return [...primary, ...roleRows];
  }, [course, sectionRoles, cohortStudents, teachers, getTeachersByCourse, removeSectionRole, t]);

  const filtered = rows.filter(
    (r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase())
  );

  function remove(row: TeamRow) {
    const msg = t(`ลบ "${row.name}" ออกจาก course นี้?`, `Remove "${row.name}" from this course?`);
    if (!window.confirm(msg)) return;
    row.onRemove?.();
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline -mt-0.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("ผู้ร่วมงาน", "Collaborators")}</span>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("จัดการผู้ร่วมงาน", "Collaborators Management")}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t("จัดการผู้ช่วยสอนและอาจารย์ร่วมสอนสำหรับ", "Manage TAs and co-teachers for")} <strong className="text-[var(--text-primary)]">{course.name}</strong>
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("เพิ่มผู้ร่วมงาน", "Add Collaborator")}
          </button>
        )}
      </div>

      {/* Course Team card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm mb-5">
        {/* Card header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("ทีมรายวิชา", "Course Team")}</h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {t("รายชื่อผู้ร่วมงานทั้งหมดที่มีสิทธิ์จัดการหรือตรวจงาน", "A list of all collaborators with administrative or grading access to this course.")}
            </p>
          </div>
          <div className="relative shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder={t("ค้นหาชื่อหรืออีเมล", "Search by name or email")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-[var(--border-subtle)] bg-[var(--bg-card)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]/30 focus:border-[var(--accent-bright)] transition-colors w-56"
            />
          </div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผู้ร่วมงานที่ตรงกัน", "No matching collaborators found")}</div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((row) => (
              <div key={row.key} className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-subtle)]/50 transition-colors">
                <Avatar initials={row.initials} bg={row.avatarBg} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{row.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{row.email}</p>
                </div>

                <div className="text-right shrink-0 max-w-[220px]">
                  <p className="text-sm font-semibold" style={{ color: row.roleBadgeColor }}>{row.roleLabel}</p>
                  <p className="text-xs text-[var(--text-muted)]">{row.permissionSummary}</p>
                </div>

                {row.removable && canManage ? (
                  <RowMenu label={t("ลบออก", "Remove")} onRemove={() => remove(row)} />
                ) : (
                  <div className="w-8" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Card footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-muted)]">
            {t("แสดง", "Showing")} <strong className="text-[var(--text-primary)]">{filtered.length}</strong> {t("ผู้ร่วมงาน", filtered.length !== 1 ? "collaborators" : "collaborator")}
          </p>
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {t("อาจารย์ผู้สอนหลักกำหนดโดยผู้ดูแลระบบ", "Primary teacher is assigned by an admin")}
          </p>
        </div>
      </div>

      {/* Invite Code card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm">
        <div className="flex items-start justify-between gap-6 px-6 py-5">
          <div className="flex-1">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">{t("รหัสเชิญ", "Invite Code")}</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm">
              {t("แชร์รหัสนี้เพื่อให้ผู้ช่วยสอนขอเข้าร่วม คำขอต้องได้รับการอนุมัติจากคุณ", "Share this code to allow TAs to request access to this course. Requests will need your approval.")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-4 py-2 border border-[var(--border-subtle)] rounded-xl text-sm font-mono font-semibold text-[var(--text-primary)] bg-[var(--bg-subtle)] min-w-[80px] text-center tracking-widest">
              {inviteCode}
            </div>
            <button
              onClick={copyCode}
              className={[
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                copied
                  ? "bg-[var(--s-ok-bg)] border-transparent text-[var(--s-ok-text)]"
                  : "border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
              ].join(" ")}
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {t("คัดลอกแล้ว", "Copied")}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {t("คัดลอก", "Copy")}
                </>
              )}
            </button>
            <button
              onClick={() => setInviteCode(generateCode())}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              {t("สร้างใหม่", "Regenerate")}
            </button>
          </div>
        </div>
      </div>

      {addOpen && <AddCollaboratorDrawer courseId={course.id} onClose={() => setAddOpen(false)} />}
    </main>
  );
}
