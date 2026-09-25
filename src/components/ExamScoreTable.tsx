"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { Student } from "@/lib/students";
import SearchInput from "@/components/SearchInput";

/**
 * Score entry for an Exam (25/9/2569). Students never submit an exam, so there are no submissions to
 * open — every enrolled student gets a row here and the teacher types each score in, then saves them
 * all at once. Empty = not scored yet.
 */
export default function ExamScoreTable({ students, titleOf, scores, maxPoints, readOnly, readOnlyReason, onSave }: {
  students: Student[];
  titleOf: (studentId: string) => string | undefined;
  /** Current saved score per studentId (absent = not scored). */
  scores: Record<string, number>;
  maxPoints: number;
  readOnly: boolean;
  /** Shown instead of the Save button while the table can't be edited. */
  readOnlyReason?: string;
  onSave: (changes: Record<string, number | null>) => void;
}) {
  const { t } = useLanguage();
  const saved = (id: string) => (scores[id] === undefined ? "" : String(scores[id]));
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.studentId, saved(s.studentId)])));
  const [search, setSearch] = useState("");

  const value = (id: string) => draft[id] ?? saved(id);
  const parse = (raw: string): number | null | "bad" => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= maxPoints ? n : "bad";
  };

  const changed = students.filter((s) => value(s.studentId) !== saved(s.studentId));
  const anyBad = changed.some((s) => parse(value(s.studentId)) === "bad");

  function handleSave() {
    const changes: Record<string, number | null> = {};
    const normalised: Record<string, string> = {};
    changed.forEach((s) => {
      const p = parse(value(s.studentId));
      if (p === "bad") return;
      changes[s.studentId] = p;
      normalised[s.studentId] = p === null ? "" : String(p); // "80.0" → "80", so the row reads as saved
    });
    onSave(changes);
    setDraft((d) => ({ ...d, ...normalised }));
  }

  const q = search.trim().toLowerCase();
  const visible = students.filter((s) => !q || [s.studentId, s.firstName, s.lastName, `${s.firstName} ${s.lastName}`].some((f) => f.toLowerCase().includes(q)));
  const th = "px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider";

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-subtle)] flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("คะแนนสอบ", "Exam scores")}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t(`นักศึกษาไม่ต้องส่งงาน — กรอกคะแนนเต็ม ${maxPoints} ของแต่ละคน ช่องที่เว้นว่างคือยังไม่มีคะแนน`, `Students don't submit an exam — enter each score out of ${maxPoints}. A blank box means not scored yet.`)}
          </p>
        </div>
        {readOnly ? (
          readOnlyReason && <span className="text-xs text-[var(--text-muted)]">{readOnlyReason}</span>
        ) : (
          <div className="flex items-center gap-3">
            {changed.length > 0 && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums" aria-live="polite">
                {t(`แก้ไข ${changed.length} รายการ`, `${changed.length} changed`)}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={changed.length === 0 || anyBad}
              className="h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              {t("บันทึกคะแนน", "Save scores")}
            </button>
          </div>
        )}
      </div>

      {students.length > 0 && (
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("ค้นหานักศึกษา...", "Search students...")}
            ariaLabel={t("ค้นหานักศึกษา", "Search students")}
            className="w-64"
            suggestions={students.flatMap((s) => [`${s.firstName} ${s.lastName}`, s.studentId])}
          />
        </div>
      )}

      {students.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">{t("ยังไม่มีนักศึกษาในวิชานี้", "No students in this course yet")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th scope="col" className={th}>#</th>
                <th scope="col" className={th}>{t("รหัสนักศึกษา", "Student ID")}</th>
                <th scope="col" className={th}>{t("ชื่อ-นามสกุล", "Name")}</th>
                <th scope="col" className={th}>{t("คะแนน", "Score")}</th>
                <th scope="col" className={th}>{t("สถานะ", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผลการค้นหา", "No results found")}</td></tr>
              )}
              {visible.map((s) => {
                const raw = value(s.studentId);
                const parsed = parse(raw);
                const bad = parsed === "bad";
                const isSaved = scores[s.studentId] !== undefined && raw === saved(s.studentId);
                const title = titleOf(s.studentId);
                return (
                  <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-subtle)] transition-colors">
                    <td className="px-4 py-2 text-xs text-[var(--text-muted)] tabular-nums">{students.indexOf(s) + 1}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)] tabular-nums">{s.studentId}</td>
                    <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{title ? `${title} ` : ""}{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={maxPoints}
                          step="any"
                          value={raw}
                          disabled={readOnly}
                          onChange={(e) => setDraft((d) => ({ ...d, [s.studentId]: e.target.value }))}
                          aria-label={t(`คะแนนของ ${s.firstName} ${s.lastName}`, `Score for ${s.firstName} ${s.lastName}`)}
                          aria-invalid={bad}
                          className={`w-24 h-9 px-3 rounded-lg border text-sm tabular-nums text-[var(--text-primary)] bg-[var(--bg-surface)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ${
                            bad ? "border-[var(--s-err-bd)] focus:ring-[var(--s-err-text)]/30" : "border-[var(--border)] focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                          }`}
                        />
                        <span className="text-xs text-[var(--text-muted)] tabular-nums">/ {maxPoints}</span>
                        {bad && <span role="alert" className="text-xs text-[var(--s-err-text)]">{t(`0–${maxPoints} เท่านั้น`, `0–${maxPoints} only`)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {isSaved ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]">{t("มีคะแนนแล้ว", "Scored")}</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{raw === "" ? t("ยังไม่มีคะแนน", "Not scored") : t("ยังไม่บันทึก", "Unsaved")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
