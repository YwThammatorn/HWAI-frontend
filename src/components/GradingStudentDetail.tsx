"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { submissionAttachments, type Assignment, type Rubric } from "@/lib/assignments";
import type { SubmissionRow } from "@/lib/groupSubmissions";
import { rowFigures } from "@/lib/gradingRows";
import { SCORE_TEXT_CLASSES, SCORE_TONE_CLASSES, PENDING_CHIP_CLASSES, NOTICE_CHIP_CLASSES, toneForPct } from "@/lib/scoreBook";
import { linkInfo } from "@/lib/linkProvider";
import { resolveFileUrl } from "@/lib/fileStorage";
import { splitCriterionName } from "@/lib/rubricName";
import { getInitials } from "@/lib/utils";
import { dateLocale } from "@/lib/dateLocale";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
import MetricCard from "@/components/MetricCard";
import Modal from "@/components/Modal";
import { Thumb } from "@/components/SubmissionViewer";

/**
 * The right pane of the Grading page (10/11/2569): everything about ONE student (or team) without leaving the page — who, the status, what the
 * score is now / what the AI gave / what the teacher saved, the points on each criterion next to the AI's and the class average, and the work they
 * handed in as pictures. The two actions are always at the top: Grade (opens the grading screen) and Re-grade (the AI again, when it is part of
 * grading this assignment). Nothing here is hover-only.
 */
export default function GradingStudentDetail({
  row, assignment, rubric, aiGraded, gradeLocked, reviewHref, regrading, onRegrade, canReGrade = true, classAvgPct, position, onPrev, onNext, onBack,
}: {
  row: SubmissionRow;
  assignment: Assignment;
  rubric?: Rubric;
  /** the AI is part of grading this assignment (false = graded by hand) */
  aiGraded: boolean;
  /** grading has not opened yet: Grade and Re-grade are off */
  gradeLocked: boolean;
  reviewHref: string;
  regrading: boolean;
  onRegrade: () => void;
  /** false for a TA: the AI is the teacher's */
  canReGrade?: boolean;
  /** class average per criterion (0–100, from lib/gradingInsights) */
  classAvgPct: Record<string, number>;
  /** "3 of 30" for the arrows, null when the row is not in the shown list */
  position: { index: number; total: number } | null;
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
}) {
  const { t, lang } = useLanguage();
  const f = rowFigures(assignment, row, aiGraded);
  const rep = f.rep;
  const isTeam = !!row.teamName;
  const [big, setBig] = useState<string | null>(null);
  const files = submissionAttachments(rep);
  const criteria = rubric?.criteria ?? [];
  const marks = rep.criterionScores;
  const aiMarks = rep.aiCriterionScores;

  const mixed = new Set(row.subs.map((s) => s.status)).size > 1;
  const status = mixed
    ? { label: t("ไม่ตรงกัน", "Mixed"), cls: NOTICE_CHIP_CLASSES }
    : rep.status === "graded"
      ? { label: t("ตรวจแล้ว", "Graded"), cls: SCORE_TONE_CLASSES.ok }
      : rep.status === "need_review"
        ? { label: t("รอตรวจสอบ", "Needs review"), cls: NOTICE_CHIP_CLASSES }
        : { label: t("ยังไม่ได้ตรวจ", "Not graded"), cls: PENDING_CHIP_CLASSES };
  const chip = "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold";
  const btn = "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]";
  const heading = "mb-3 text-sm font-bold text-[var(--text-primary)]";

  return (
    <div data-testid="grading-detail" className="flex flex-col gap-6 p-5">
      {/* The way back on the left, the way along the list on the right — one row */}
      <div className="-mb-2 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} data-testid="detail-back" className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]">
          <Icon name="arrow-left" />
          {t("ภาพรวมของห้อง", "Class overview")}
        </button>
        {position && (
          <span className="flex items-center gap-0.5">
            <IconButton icon="chevron-left" label={t("คนก่อนหน้า", "Previous")} onClick={onPrev} disabled={!onPrev} />
            <span className="min-w-14 text-center text-sm tabular-nums text-[var(--text-secondary)]">{position.index + 1} / {position.total}</span>
            <IconButton icon="chevron-right" label={t("คนถัดไป", "Next")} onClick={onNext} disabled={!onNext} />
          </span>
        )}
      </div>

      {/* Who, and what to do with it */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={getInitials(isTeam ? row.teamName! : rep.studentName)} size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--text-primary)]">{isTeam ? row.teamName : rep.studentName}</h2>
            <p className="truncate text-xs text-[var(--text-muted)]">{isTeam ? row.subs.map((s) => s.studentName).join(", ") : rep.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aiGraded && canReGrade && (
            <button
              type="button"
              onClick={onRegrade}
              disabled={regrading || gradeLocked}
              data-testid="detail-regrade"
              className={`${btn} border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-bright)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Icon name={regrading ? "spinner" : "rotate-ccw"} className={regrading ? "animate-spin" : ""} />
              {t("Re-grade", "Re-grade")}
            </button>
          )}
          {gradeLocked ? (
            <span
              data-testid="detail-grade-locked"
              aria-disabled="true"
              title={t("ยังไม่เปิดให้ตรวจ — ดูเวลาเปิดที่ด้านบนของหน้า", "Grading is not open yet — see the time at the top of the page")}
              className={`${btn} cursor-not-allowed border border-[var(--border)] text-[var(--text-muted)]`}
            >
              <Icon name="lock" />{isTeam ? t("ตรวจทั้งทีม", "Grade team") : t("ตรวจ", "Grade")}
            </span>
          ) : (
            <Link href={reviewHref} data-testid="detail-grade" className={`${btn} bg-[var(--accent-solid)] text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)]`}>
              <Icon name="play" />{isTeam ? t("ตรวจทั้งทีม", "Grade team") : t("ตรวจ", "Grade")}
            </Link>
          )}
        </div>
      </div>

      {/* Status and flags */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${chip} ${status.cls}`}>{status.label}</span>
        {row.subs.some((s) => s.late) && (
          <span className={`${chip} ${NOTICE_CHIP_CLASSES}`}>
            {t("ส่งช้า", "Late")}{f.penalty > 0 && <span className="tabular-nums"> · −{f.penalty}</span>}
          </span>
        )}
        {f.edited && <span className={`${chip} ${SCORE_TONE_CLASSES.info}`}>{t("แก้จาก AI", "Edited")}</span>}
        <span className="text-xs text-[var(--text-muted)]">
          {t("ส่งเมื่อ", "Submitted")} {new Date(rep.submittedAt).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Score: what counts now, what the AI gave, what the teacher saved */}
      <MetricCard
        label={t(`คะแนน (เต็ม ${assignment.maxPoints})`, `Score (of ${assignment.maxPoints})`)}
        parts={[
          { label: t("ตอนนี้", "Now"), value: f.score ?? "—" },
          ...(aiGraded ? [{ label: "AI", value: rep.aiScore ?? "—" }] : []),
          { label: t("บันทึกแล้ว", "Saved"), value: rep.instructorScore ?? "—" },
        ]}
        tone="rating"
        icon="star"
      />

      {/* Points on each criterion, next to the AI's mark and the class average */}
      {criteria.length > 0 && (
        <section aria-labelledby="detail-criteria-h">
          <h3 id="detail-criteria-h" className={heading}>{t("คะแนนรายเกณฑ์", "Points per criterion")}</h3>
          {marks ? (
            <ul className="flex flex-col gap-3" data-testid="detail-criteria">
              {criteria.map((c) => {
                const v = marks[c.id];
                const ai = aiMarks?.[c.id];
                const pct = typeof v === "number" && c.maxPoints > 0 ? (v / c.maxPoints) * 100 : null;
                const avg = classAvgPct[c.id];
                const nm = splitCriterionName(c.name);
                return (
                  <li key={c.id} data-criterion={c.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">{nm.code ? `${nm.code} · ` : ""}{nm.main}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className={`font-bold ${pct !== null ? SCORE_TEXT_CLASSES[toneForPct(pct)] : "text-[var(--text-secondary)]"}`}>{typeof v === "number" ? v : "—"}</span>
                        <span className="text-xs text-[var(--text-muted)]"> / {c.maxPoints}</span>
                        {typeof ai === "number" && ai !== v && <span className="ml-2 text-xs text-[var(--text-secondary)]">AI {ai}</span>}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-[var(--bg-app)]" aria-hidden="true">
                      {pct !== null && <span className={`block h-full rounded-full bg-current ${SCORE_TEXT_CLASSES[toneForPct(pct)]}`} style={{ width: `${Math.min(100, pct)}%` }} />}
                    </div>
                    {avg !== undefined && (
                      <p className="mt-1 text-xs tabular-nums text-[var(--text-muted)]">{t("เฉลี่ยห้อง", "Class average")} {Math.round(avg)}%</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-testid="detail-no-marks" className="rounded-xl bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              {t("ยังไม่มีคะแนนรายเกณฑ์ — กด “ตรวจ” เพื่อให้คะแนนทีละเกณฑ์", "No per-criterion points yet — press Grade to score each criterion.")}
            </p>
          )}
        </section>
      )}

      {/* The work they handed in, as pictures */}
      <section aria-labelledby="detail-work-h">
        <h3 id="detail-work-h" className={heading}>{t("งานที่ส่ง", "Submitted work")}</h3>
        {files.length === 0 ? (
          <p data-testid="detail-no-files" className="text-sm text-[var(--text-muted)]">{t("ไม่มีไฟล์หรือลิงก์ที่แนบมา", "No files or links attached.")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="detail-files">
            {files.map((a) => {
              const isImage = a.source === "upload" && a.kind === "image" && !!resolveFileUrl(a.ref);
              const card = "block w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]";
              const caption = <span className="block truncate px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)]">{a.source === "url" ? linkInfo(a.ref).label : a.name}</span>;
              return (
                <li key={a.id}>
                  {a.source === "url" ? (
                    <a href={a.ref} target="_blank" rel="noopener noreferrer" className={card} title={a.ref}>
                      <Thumb a={a} tall />{caption}
                    </a>
                  ) : isImage ? (
                    <button type="button" onClick={() => setBig(a.id)} className={card} title={t("ดูภาพขนาดใหญ่", "View larger")}>
                      <Thumb a={a} tall />{caption}
                    </button>
                  ) : (
                    <div className={card.replace("hover:border-[var(--accent)] ", "")} title={a.name}>
                      <Thumb a={a} tall />{caption}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The teacher's own note, when there is one */}
      {rep.instructorComment.trim() && (
        <section aria-labelledby="detail-comment-h">
          <h3 id="detail-comment-h" className={heading}>{t("ความเห็นของผู้สอน", "Your comment")}</h3>
          <p className="whitespace-pre-wrap rounded-xl bg-[var(--bg-app)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)]">{rep.instructorComment}</p>
        </section>
      )}

      <Modal open={big !== null} onClose={() => setBig(null)} title={files.find((a) => a.id === big)?.name ?? ""} size="lg">
        {big && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveFileUrl(files.find((a) => a.id === big)?.ref ?? "") ?? ""} alt={files.find((a) => a.id === big)?.name ?? ""} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />
        )}
      </Modal>
    </div>
  );
}
