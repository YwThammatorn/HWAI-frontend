"use client";

import { useState, ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import type { WorkSnapshot } from "@/lib/assignments";
import Icon from "@/components/Icon";

/** A box on the current frame, numbered so it matches the chip the grader pressed (fractions 0..1 of the frame). */
export interface FrameMark { n: number; box: { x: number; y: number; w: number; h: number } }

/**
 * The student's design as it was when it was submitted (10/11/2569; R35: the work a grade rests on must not change after the deadline):
 * frozen frames as images, a strip to pick one, and — when the AI's reasoning points somewhere — boxes drawn on the frame. The live file is one
 * button away, and says that it may have changed since. Used by Grading Review (with marks) and by Calibration (blind: no names, no live link).
 */
export default function FrameViewer({ snapshot, zoom, caption, anonymous = false, frameId, onFrameChange, marks = [] }: {
  snapshot: WorkSnapshot;
  /** Same 25–200 % scale as the grading toolbar. */
  zoom: number;
  caption?: ReactNode;
  /** Blind calibration: frame names can carry a student's name, so they read "Frame 1…", and the live file's address is not offered. */
  anonymous?: boolean;
  /** Controlled when given (Grading Review points at a frame from the criteria panel); otherwise the viewer keeps its own choice. */
  frameId?: string;
  onFrameChange?: (id: string) => void;
  marks?: FrameMark[];
}) {
  const { t, lang } = useLanguage();
  const [own, setOwn] = useState<string | null>(null);
  const frames = snapshot.frames;
  const current = frames.find((f) => f.id === (frameId ?? own)) ?? frames[0];
  if (!current) return null;
  const nameOf = (id: string) => (anonymous ? t(`เฟรม ${frames.findIndex((f) => f.id === id) + 1}`, `Frame ${frames.findIndex((f) => f.id === id) + 1}`) : frames.find((f) => f.id === id)?.name ?? "");
  const pick = (id: string) => { setOwn(id); onFrameChange?.(id); };
  const taken = new Date(snapshot.takenAt);

  return (
    <div data-testid="frame-viewer" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="min-w-0 text-sm text-[var(--text-secondary)]">
          {caption && <p className="truncate font-medium text-[var(--text-primary)]">{caption}</p>}
          <p data-testid="snapshot-note" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Icon name="lock" size="sm" />
            {t("สำเนาตอนส่งงาน", "Snapshot at submission")} · {taken.toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {snapshot.sourceUrl && !anonymous && (
          <a
            data-testid="open-live-file"
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={t("เปิดไฟล์ต้นฉบับตอนนี้ — อาจแก้ไปแล้วหลังส่งงาน", "Open the file as it is now — it may have changed since it was submitted")}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
          >
            <Icon name="external-link" size="sm" />
            {t("เปิดไฟล์สด", "Open live file")}
          </a>
        )}
      </div>

      <ul aria-label={t("เฟรมของงาน", "Frames of the work")} className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5">
        {frames.map((f) => {
          const on = f.id === current.id;
          return (
            <li key={f.id} className="shrink-0">
              <button
                type="button"
                data-testid={`frame-thumb-${f.id}`}
                aria-current={on ? "true" : undefined}
                onClick={() => pick(f.id)}
                className={`flex w-28 flex-col overflow-hidden rounded-lg border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${on ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent-bright)]"}`}
              >
                {f.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.image} alt="" className="h-14 w-full bg-[var(--bg-app)] object-cover object-top" />
                  : <span aria-hidden="true" className="flex h-14 w-full items-center justify-center bg-[var(--bg-app)] text-[var(--text-muted)]"><Icon name="image" size="sm" /></span>}
                <span className="truncate px-2 py-1 text-xs font-medium text-[var(--text-primary)]" title={nameOf(f.id)}>{nameOf(f.id)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg-app)] p-6">
        <div className="relative mx-auto inline-block" style={{ width: `${zoom * 8}px`, maxWidth: "none" }}>
          {current.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="frame-image" src={current.image} alt={nameOf(current.id)} className="block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm" />
          ) : (
            // the snapshot keeps the design as JSON, not pictures (11/11/2569): the frame's outline at its own proportions, with the AI's boxes on it
            <div
              data-testid="frame-outline"
              role="img"
              aria-label={t(`เฟรม ${nameOf(current.id)} (ไม่มีภาพตัวอย่าง — เปิดไฟล์ Figma เพื่อดู)`, `Frame ${nameOf(current.id)} (no preview picture — open the Figma file to see it)`)}
              className="flex w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] text-xs text-[var(--text-muted)]"
              style={{ aspectRatio: current.width && current.height ? `${current.width} / ${current.height}` : "16 / 10" }}
            >
              {t("ไม่มีภาพตัวอย่าง — เปิดไฟล์ Figma เพื่อดู", "No preview picture — open the Figma file to see it")}
            </div>
          )}
          {!anonymous && marks.map((m) => (
            <div
              key={m.n}
              data-testid={`frame-box-${m.n}`}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-md border-2 border-[var(--accent)] bg-[var(--accent)]/10"
              style={{ left: `${m.box.x * 100}%`, top: `${m.box.y * 100}%`, width: `${m.box.w * 100}%`, height: `${m.box.h * 100}%` }}
            >
              <span className="absolute -left-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-solid)] text-xs font-bold text-[var(--accent-solid-text)]">{m.n}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">{nameOf(current.id)}</p>
      </div>
    </div>
  );
}
