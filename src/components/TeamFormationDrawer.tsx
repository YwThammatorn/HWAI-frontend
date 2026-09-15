"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useStudentGroups, StudentGroup } from "@/lib/studentGroups";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface TeamFormationDrawerProps {
  courseId: string;
  assignmentId: string;
  /** Total members including self; null/undefined means no cap. */
  maxGroupSize: number | null;
  currentStudentId: string;
  onCreated: (group: StudentGroup) => void;
  onClose: () => void;
}

export default function TeamFormationDrawer({
  courseId, assignmentId, maxGroupSize, currentStudentId, onCreated, onClose,
}: TeamFormationDrawerProps) {
  const { t } = useLanguage();
  const { getStudentsByCourse } = useStudents();
  const { groups, addGroup } = useStudentGroups();

  const dialogRef = useRef<HTMLDivElement>(null);
  const cap = maxGroupSize ?? Infinity;

  const roster = getStudentsByCourse(courseId).filter(
    (s) => s.studentId !== currentStudentId && s.enrollmentStatus !== "withdrawn"
  );

  const takenIds = useMemo(() => {
    const inThisAssignment = groups.filter((g) => g.assignmentId === assignmentId);
    return new Set(inThisAssignment.flatMap((g) => g.memberStudentIds));
  }, [groups, assignmentId]);

  const pastGroups = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .filter((g) => g.courseId === courseId && g.assignmentId !== assignmentId && g.memberStudentIds.includes(currentStudentId))
      .filter((g) => {
        const key = g.memberStudentIds.slice().sort().join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [groups, courseId, assignmentId, currentStudentId]);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = search.trim().toLowerCase();
  const candidates = roster.filter((s) => {
    if (!q) return true;
    return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
  });

  function toggle(studentId: string) {
    setSelected((prev) => {
      if (prev.includes(studentId)) return prev.filter((id) => id !== studentId);
      if (prev.length + 1 >= cap) return prev; // +1 for self
      return [...prev, studentId];
    });
  }

  function applyPreset(g: StudentGroup) {
    const others = g.memberStudentIds.filter((id) => id !== currentStudentId && !takenIds.has(id));
    setSelected(others.slice(0, Math.max(0, cap - 1)));
    setError(null);
  }

  function handleCreate() {
    const teamName = name.trim();
    if (!teamName) {
      setError(t("ตั้งชื่อทีมก่อนนะ", "Name your team first"));
      return;
    }
    const group = addGroup({
      assignmentId,
      courseId,
      name: teamName,
      memberStudentIds: [currentStudentId, ...selected],
    });
    onCreated(group);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="form-team-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="form-team-title" className="text-base font-bold text-[var(--text-primary)]">
            {t("จับกลุ่ม", "Form a team")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          <p className="text-[11px] text-[var(--text-muted)]">
            {maxGroupSize
              ? t(`เลือกเพื่อนร่วมทีมได้อีกสูงสุด ${maxGroupSize - 1} คน จากเพื่อนใน sec นี้เท่านั้น`, `Pick up to ${maxGroupSize - 1} more classmates from this section.`)
              : t("เลือกเพื่อนร่วมทีมจากเพื่อนใน sec นี้เท่านั้น (ไม่จำกัดจำนวน)", "Pick classmates from this section — no size limit.")}
          </p>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              {t("ชื่อทีม", "Team name")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder={t("เช่น ทีม A", "e.g. Team Alpha")}
              className="w-full h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
            {error && <p className="text-xs text-[var(--s-err-text)] mt-1.5">{error}</p>}
          </div>

          {pastGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {t("ใช้ทีมเดิม", "Reuse a previous team")}
              </label>
              <div className="flex flex-col gap-1.5">
                {pastGroups.map((g) => {
                  const others = g.memberStudentIds.filter((id) => id !== currentStudentId);
                  const fits = others.length <= cap - 1;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!fits}
                      onClick={() => applyPreset(g)}
                      title={fits ? undefined : t(`สมาชิกเกินจำนวนที่งานนี้กำหนด (สูงสุด ${maxGroupSize})`, `Too many members for this assignment (max ${maxGroupSize})`)}
                      className="text-left px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm hover:border-[var(--accent-bright)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-transparent"
                    >
                      <span className="font-medium text-[var(--text-primary)]">{g.name}</span>
                      <span className="block text-xs text-[var(--text-muted)] mt-0.5 truncate">
                        {others
                          .map((id) => { const s = roster.find((r) => r.studentId === id); return s ? `${s.firstName} ${s.lastName}` : id; })
                          .join(", ") || t("(คนเดียว)", "(solo)")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              {t("เพื่อนร่วมทีม", "Teammates")}
            </label>
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ค้นหาชื่อ/รหัสนักศึกษา", "Search name / student ID")}
                className="w-full h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
            </div>

            {candidates.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">{t("ไม่พบเพื่อนที่ตรงกัน", "No matching classmates")}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {candidates.map((s) => {
                  const isTaken = takenIds.has(s.studentId);
                  const isChecked = selected.includes(s.studentId);
                  const isFull = !isChecked && selected.length + 1 >= cap;
                  const disabled = isTaken || (isFull && !isChecked);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${disabled ? "opacity-40" : "hover:bg-[var(--bg-subtle)] cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => toggle(s.studentId)}
                        className="shrink-0"
                      />
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] text-xs font-bold shrink-0">
                        {initialsOf(`${s.firstName} ${s.lastName}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums truncate">{s.studentId}</p>
                      </div>
                      {isTaken && (
                        <span className="text-[11px] text-[var(--text-muted)] shrink-0">{t("อยู่ทีมอื่นแล้ว", "already in a team")}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button onClick={handleCreate} className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] transition-colors">
            {t("สร้างทีม", "Create team")}
          </button>
        </div>
      </div>
    </div>
  );
}
