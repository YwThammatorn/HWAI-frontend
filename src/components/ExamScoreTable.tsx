"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { Student } from "@/lib/students";
import SearchInput from "@/components/SearchInput";
import ImportExamScoresModal from "@/components/ImportExamScoresModal";

import Icon from "@/components/Icon";
/**
 * Score entry for an Exam (25/9/2569). Students never submit an exam, so there are no submissions to
 * open — every enrolled student gets a row here and the teacher types each score in, then saves them
 * all at once. Empty = not scored yet.
 */
export default function ExamScoreTable({ students, titleOf, scores, maxPoints, examName, weight, readOnly, readOnlyReason, withdrawnIds, onSave }: {
  students: Student[];
  titleOf: (studentId: string) => string | undefined;
  /** Current saved score per studentId (absent = not scored). */
  scores: Record<string, number>;
  maxPoints: number;
  /** Which exam this is ("สอบปลายภาค") and the share of the course total its category is worth — shown in the heading so the "/ 35" is not a mystery. */
  examName?: string;
  weight?: number | null;
  readOnly: boolean;
  /** Shown instead of the Save button while the table can't be edited. */
  readOnlyReason?: string;
  /** Students who withdrew from the course — a CSV row for one of them is refused with that reason. */
  withdrawnIds?: Set<string>;
  onSave: (changes: Record<string, number | null>) => void;
}) {
  const { t } = useLanguage();
  const saved = (id: string) => (scores[id] === undefined ? "" : String(scores[id]));
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.studentId, saved(s.studentId)])));
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  // Boxes filled from a CSV and not saved yet: highlighted, with a note, until the teacher saves (or edits them).
  const [imported, setImported] = useState<Set<string>>(new Set());

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
    setImported(new Set());
  }

  function applyImport(values: Record<string, string>) {
    setDraft((d) => ({ ...d, ...values }));
    setImported(new Set(Object.keys(values)));
  }

  const q = search.trim().toLowerCase();
  const visible = students.filter((s) => !q || [s.studentId, s.firstName, s.lastName, `${s.firstName} ${s.lastName}`].some((f) => f.toLowerCase().includes(q)));
  const th = "px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider";

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-subtle)] flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("คะแนนสอบ", "Exam scores")}{examName ? ` · ${examName}` : ""}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t(`นักศึกษาไม่ต้องส่งงาน — กรอกคะแนนเต็ม ${maxPoints}${weight ? ` (คิดเป็น ${weight}% ของคะแนนรวมวิชา)` : ""} ของแต่ละคน ช่องที่เว้นว่างคือยังไม่มีคะแนน`, `Students don't submit an exam — enter each score out of ${maxPoints}${weight ? ` (worth ${weight}% of the course total)` : ""}. A blank box means not scored yet.`)}
          </p>
        </div>
        {readOnly ? (
          readOnlyReason && (
            <span data-testid="scores-locked" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-app)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              <Icon name="lock" size="sm" />
              {readOnlyReason}
            </span>
          )
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              <Icon name="download" />
              {t("นำเข้าด้วย CSV", "Import CSV")}
            </button>
          </div>
        )}
      </div>

      {imported.size > 0 && !readOnly && (
        <p role="status" data-testid="import-note" className="flex items-center gap-2 border-b border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-5 py-2.5 text-sm text-[var(--s-info-text)]">
          {t(`กรอกคะแนนจาก CSV แล้ว ${imported.size} คน (ช่องที่ไฮไลต์) — ตรวจดูแล้วกด “บันทึกคะแนน”`, `${imported.size} ${imported.size === 1 ? "score" : "scores"} filled from the CSV (highlighted) — check them, then press “Save scores”`)}
        </p>
      )}

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
                      {readOnly ? (
                        // locked (grading is finished / a withdrawn student): the score is read, not typed — a disabled box still looked editable (advisor, 10/11/2569)
                        <div className="flex items-baseline gap-1.5" aria-label={t(`คะแนนของ ${s.firstName} ${s.lastName}`, `Score for ${s.firstName} ${s.lastName}`)}>
                          <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{raw === "" ? "—" : raw}</span>
                          <span className="text-xs text-[var(--text-muted)] tabular-nums">/ {maxPoints}</span>
                        </div>
                      ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={maxPoints}
                          step="any"
                          value={raw}
                          disabled={readOnly}
                          onChange={(e) => { setDraft((d) => ({ ...d, [s.studentId]: e.target.value })); if (imported.has(s.studentId)) setImported((p) => { const n = new Set(p); n.delete(s.studentId); return n; }); }}
                          aria-label={t(`คะแนนของ ${s.firstName} ${s.lastName}`, `Score for ${s.firstName} ${s.lastName}`)}
                          aria-invalid={bad}
                          className={`w-24 h-9 px-3 rounded-lg border text-sm tabular-nums text-[var(--text-primary)] bg-[var(--bg-surface)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ${
                            bad ? "border-[var(--s-err-bd)] focus:ring-[var(--s-err-text)]/30" : imported.has(s.studentId) ? "border-[var(--s-info-bd)] bg-[var(--s-info-bg)] focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]" : "border-[var(--border)] focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                          }`}
                        />
                        <span className="text-xs text-[var(--text-muted)] tabular-nums">/ {maxPoints}</span>
                        {bad && <span role="alert" className="text-xs text-[var(--s-err-text)]">{t(`0–${maxPoints} เท่านั้น`, `0–${maxPoints} only`)}</span>}
                      </div>
                      )}
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
      {!readOnly && students.length > 0 && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3">
          <span className="text-xs text-[var(--text-muted)] tabular-nums" aria-live="polite">
            {changed.length > 0 ? t(`แก้ไข ${changed.length} รายการ ยังไม่บันทึก`, `${changed.length} changed, not saved yet`) : t("ยังไม่มีการแก้ไข", "No changes yet")}
          </span>
          <button
            type="button"
            data-testid="save-scores-foot"
            onClick={handleSave}
            disabled={changed.length === 0 || anyBad}
            className="h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-all"
          >
            {t("บันทึกคะแนน", "Save scores")}
          </button>
        </div>
      )}
      {importOpen && (
        <ImportExamScoresModal
          students={students}
          withdrawnIds={withdrawnIds ?? new Set()}
          maxPoints={maxPoints}
          currentOf={value}
          onApply={applyImport}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
