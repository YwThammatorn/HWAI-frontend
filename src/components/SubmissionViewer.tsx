"use client";

import { useEffect, useState, ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { AssignmentAttachment } from "@/lib/assignments";
import { resolveFileUrl } from "@/lib/fileStorage";
import { linkInfo } from "@/lib/linkProvider";
import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";

interface Resolved {
  id: string;
  /** Blob URL of the stored upload; null when the file is gone from storage. */
  url: string | null;
  type: string;
}

/** The picture on a strip card (9/11/2569): the image itself for an image upload, the provider's glyph for a link, a file glyph with its extension otherwise. */
export function Thumb({ a, tall = false }: { a: AssignmentAttachment; tall?: boolean }) {
  const box = `flex ${tall ? "h-24" : "h-14"} w-full items-center justify-center bg-[var(--bg-app)] text-[var(--accent)]`;
  if (a.source === "upload" && a.kind === "image") {
    const src = resolveFileUrl(a.ref);
    if (src) {
      // eslint-disable-next-line @next/next/no-img-element
      return <span className={box}><img src={src} alt="" className="h-full w-full object-cover" /></span>;
    }
    return <span className={box}><Icon name="image" size="lg" /></span>;
  }
  if (a.source === "url") return <span className={box}><Icon name={linkInfo(a.ref).icon} size="lg" /></span>;
  const ext = (a.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "").toUpperCase();
  return (
    <span className={`${box} flex-col gap-0.5`}>
      <Icon name="file-text" size="lg" />
      {ext && <span className="text-[10px] font-bold leading-none tracking-wider text-[var(--text-secondary)]">{ext}</span>}
    </span>
  );
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
  caption?: ReactNode;
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
        try { blob = await (await fetch(dataUrl)).blob(); } catch { blob = null; }
      }
      if (cancelled) return;
      if (blob) objectUrl = URL.createObjectURL(blob);
      setResolved({ id: selId, url: objectUrl ?? null, type: blob?.type ?? "" });
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selId, selRef, selSource]);

  if (!sel) return <>{empty}</>;

  const ready = sel.source === "upload" && resolved?.id === sel.id ? resolved : null;
  const paperWidth = zoom * 5;
  const paperHeight = zoom * 7;
  // shrink-0: a zoomed-in file must scroll inside the pane, not get squeezed to fit it
  const card = "shrink-0 bg-[var(--bg-surface)] shadow-xl rounded-sm p-8 text-center flex flex-col items-center gap-3";

  let body: ReactNode;
  if (sel.source === "url") {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <IconTile icon={linkInfo(sel.ref).icon} size="lg" tone="accent" />
        <p className="text-base font-bold text-[var(--text-primary)]">{linkInfo(sel.ref).label}</p>
        <p data-testid="link-address" className="max-w-full break-all text-sm text-[var(--text-secondary)]">{anonymous ? shownName(sel) : <>{linkInfo(sel.ref).host}{linkInfo(sel.ref).path && <span className="text-[var(--text-muted)]"> / {linkInfo(sel.ref).path}</span>}</>}</p>
        <p className="text-xs text-[var(--text-muted)]">{t("ลิงก์ที่นักศึกษาส่ง — เปิดในแท็บใหม่", "Link submitted by the student — opens in a new tab")}</p>
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
        {onOpenLink && <p className="text-xs text-[var(--text-muted)]">{t("ส่วนตรวจจะลอยอยู่ในหน้าต่างเล็ก ให้ตรวจไปพร้อมดูลิงก์ได้", "The grading part floats in a small window, so you can grade while you look at the link")}</p>}
      </div>
    );
  } else if (!ready) {
    body = <p className="text-sm text-[var(--text-muted)] mt-10">{t("กำลังโหลดไฟล์...", "Loading file...")}</p>;
  } else if (!ready.url) {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{shownName(sel)}</p>
        <p className="text-xs text-[var(--text-muted)]">{t("ไม่พบไฟล์นี้ในที่เก็บข้อมูลแล้ว", "This file is no longer in storage")}</p>
      </div>
    );
  } else if (sel.kind === "image" || ready.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={ready.url} alt={shownName(sel)} style={{ width: paperWidth, maxWidth: "none" }} className="shrink-0 bg-[var(--bg-surface)] shadow-xl rounded-sm" />;
  } else if (ready.type === "application/pdf" || /\.pdf$/i.test(sel.name)) {
    body = (
      <iframe
        src={ready.url}
        title={shownName(sel)}
        style={{ width: paperWidth, height: paperHeight }}
        className="shrink-0 bg-[var(--bg-surface)] shadow-xl rounded-sm border-0"
      />
    );
  } else {
    body = (
      <div className={card} style={{ width: paperWidth }}>
        <p className="text-sm font-semibold text-[var(--text-primary)] break-all">{shownName(sel)}</p>
        <p className="text-xs text-[var(--text-muted)]">{t("ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ — ดาวน์โหลดเพื่อเปิดดู", "No preview for this file type — download it to open")}</p>
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
      <div className="px-5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-col gap-2">
        {caption && <p className="text-xs text-[var(--text-secondary)]">{caption}</p>}
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
                  className={`w-28 overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)]"
                  }`}
                >
                  <Thumb a={a} />
                  <span className={`block truncate px-2 py-1 text-xs font-medium ${active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                    {a.kind === "link" && !anonymous ? `${t("ลิงก์", "Link")}: ${a.name}` : shownName(a)}
                  </span>
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
