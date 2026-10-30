"use client";

import { useEffect, useState, ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { AssignmentAttachment } from "@/lib/assignments";
import { resolveFileUrl } from "@/lib/fileStorage";

interface Resolved {
  id: string;
  /** Blob URL of the stored upload; null when the file is gone from storage. */
  url: string | null;
  type: string;
}

/**
 * The teacher's view of what a student submitted: pick one of the files/links in
 * the strip above, and the pane shows it (images and PDFs inline, everything else
 * as a download; links open in a new tab since most sites refuse to be framed).
 * Falls back to `empty` when nothing was submitted.
 */
export default function SubmissionViewer({ attachments, zoom, caption, empty, anonymous = false, onOpenLink }: {
  attachments: AssignmentAttachment[];
  /** Same 25–200 % scale as the grading toolbar. */
  zoom: number;
  caption?: string;
  empty: ReactNode;
  /** Blind calibration (14/10/2569): file and link names can carry a student's name or account, so they are shown as "File 1", "Link 1"
   *  (the link itself still opens). The caption is the caller's to leave out. */
  anonymous?: boolean;
  /** Called when the teacher opens a submitted link (the link still opens in its own tab). The Grade screen uses it to float the grading part in a small window next to it. */
  onOpenLink?: () => void;
}) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const sel = attachments.find((a) => a.id === selectedId) ?? attachments[0];
  const shownName = (a: AssignmentAttachment) => {
    if (!anonymous) return a.name;
    const nth = attachments.filter((x) => x.kind === a.kind).indexOf(a) + 1;
    return a.kind === "link" ? `${t("ลิงก์", "Link")} ${nth}` : `${t("ไฟล์", "File")} ${nth}`;
  };
  const selId = sel?.id;
  const selRef = sel?.ref;
  const selSource = sel?.source;
  const selName = sel?.name;

  // Uploads live as data URLs in mock storage; browsers won't frame or navigate to
  // data: URLs, so hand the pane a Blob URL instead (and release it when we move on).
  useEffect(() => {
    if (!selId || !selRef || selSource !== "upload") return;
    let cancelled = false;
    let objectUrl: string | undefined;
    (async () => {
      let blob: Blob | null = null;
      const dataUrl = resolveFileUrl(selRef);
      if (dataUrl) {
        try { blob = await (await fetch(dataUrl, { credentials: "include" })).blob(); } catch { blob = null; }
      }
      // A ".pdf" is shown in an iframe on this app's origin — pin its type to PDF so a mislabelled
      // HTML file can only ever render as a (broken) PDF, never run script.
      if (blob && /\.pdf$/i.test(selName ?? "") && blob.type !== "application/pdf") {
        blob = new Blob([blob], { type: "application/pdf" });
      }
      if (cancelled) return;
      if (blob) objectUrl = URL.createObjectURL(blob);
      setResolved({ id: selId, url: objectUrl ?? null, type: blob?.type ?? "" });
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selId, selRef, selSource, selName]);

  if (!sel) return <>{empty}</>;

  const ready = sel.source === "upload" && resolved?.id === sel.id ? resolved : null;
  const paperWidth = zoom * 5;
  const paperHeight = zoom * 7;
  // shrink-0: a zoomed-in file must scroll inside the pane, not get squeezed to fit it
  const card = "shrink-0 bg-white shadow-xl rounded-sm p-8 text-center flex flex-col items-center gap-3";

  let body: ReactNode;
  if (sel.source === "url") {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <p className="text-sm font-semibold text-[var(--text-primary)] break-all">{anonymous ? shownName(sel) : sel.ref}</p>
        <p className="text-xs text-gray-400">{t("ลิงก์ที่นักศึกษาส่ง — เปิดในแท็บใหม่", "Link submitted by the student — opens in a new tab")}</p>
        <a
          href={sel.ref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpenLink}
          data-testid="open-link"
          className="inline-flex items-center h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
        >
          {onOpenLink ? t("เปิดลิงก์และตรวจในก้อนเล็ก", "Open link and grade in a small window") : t("เปิดลิงก์", "Open link")}
        </a>
        {onOpenLink && <p className="text-xs text-gray-400">{t("ส่วนตรวจจะลอยอยู่ในหน้าต่างเล็ก ให้ตรวจไปพร้อมดูลิงก์ได้", "The grading part floats in a small window, so you can grade while you look at the link")}</p>}
      </div>
    );
  } else if (!ready) {
    body = <p className="text-sm text-gray-400 mt-10">{t("กำลังโหลดไฟล์...", "Loading file...")}</p>;
  } else if (!ready.url) {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{shownName(sel)}</p>
        <p className="text-xs text-gray-400">{t("ไม่พบไฟล์นี้ในที่เก็บข้อมูลแล้ว", "This file is no longer in storage")}</p>
      </div>
    );
  } else if (sel.kind === "image" || ready.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={ready.url} alt={shownName(sel)} style={{ width: paperWidth, maxWidth: "none" }} className="shrink-0 bg-white shadow-xl rounded-sm" />;
  } else if (ready.type === "application/pdf" || /\.pdf$/i.test(sel.name)) {
    body = (
      <iframe
        src={ready.url}
        title={shownName(sel)}
        style={{ width: paperWidth, height: paperHeight }}
        className="shrink-0 bg-white shadow-xl rounded-sm border-0"
      />
    );
  } else {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <p className="text-sm font-semibold text-[var(--text-primary)] break-all">{shownName(sel)}</p>
        <p className="text-xs text-gray-400">{t("ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ — ดาวน์โหลดเพื่อเปิดดู", "No preview for this file type — download it to open")}</p>
        <a
          href={ready.url}
          download={anonymous ? shownName(sel) : sel.name}
          className="inline-flex items-center h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
        >
          {t("ดาวน์โหลด", "Download")}
        </a>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex flex-col gap-2">
        {caption && <p className="text-xs text-gray-500">{caption}</p>}
        <ul className="flex gap-2 overflow-x-auto" aria-label={t("ไฟล์ที่นักศึกษาส่ง", "Files the student submitted")}>
          {attachments.map((a) => {
            const active = a.id === sel.id;
            return (
              <li key={a.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  aria-pressed={active}
                  title={shownName(a)}
                  className={`max-w-[220px] truncate h-8 px-3 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-gray-200 text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  {a.kind === "link" && !anonymous ? `${t("ลิงก์", "Link")}: ${a.name}` : shownName(a)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-8">{body}</div>
    </div>
  );
}
