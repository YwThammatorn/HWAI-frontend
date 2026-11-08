"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { AssignmentAttachment } from "@/lib/assignments";
import { storeFile, resolveFileUrl, removeFile, FileTooLargeError } from "@/lib/fileStorage";

import Icon, { type IconName } from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
const MAX_ATTACHMENTS = 10;
const FILE_ACCEPT = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";

/** Accepts "example.com/x" or a full URL; returns a normalised http(s) URL or null. */
export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Draft state for an assignment's attachments on a create/edit form.
 * Uploads land in mock storage the moment they're picked, so this hook also
 * owns cleanup: removing a just-added upload frees it immediately, leaving the
 * page without saving frees everything added this session, and `commit()` (call
 * after a successful save) frees originals the teacher removed.
 */
export function useAttachmentsDraft(initial: AssignmentAttachment[] = []) {
  const [items, setItemsState] = useState<AssignmentAttachment[]>(initial);
  const itemsRef = useRef<AssignmentAttachment[]>(initial);
  const originalRef = useRef<AssignmentAttachment[]>(initial);
  const committedRef = useRef(false);
  // True when the draft differs from the saved baseline (for unsaved-changes guards).
  const [dirty, setDirty] = useState(false);
  const differs = (a: AssignmentAttachment[], b: AssignmentAttachment[]) =>
    a.length !== b.length || a.some((x, i) => x.id !== b[i].id);

  const setItems = useCallback((next: AssignmentAttachment[]) => {
    const keep = new Set(next.map((i) => i.id));
    itemsRef.current.forEach((i) => {
      const isOriginal = originalRef.current.some((o) => o.id === i.id);
      if (!keep.has(i.id) && i.source === "upload" && !isOriginal) removeFile(i.ref);
    });
    itemsRef.current = next;
    setItemsState(next);
    setDirty(differs(next, originalRef.current));
  }, []);

  /** Load the saved attachments as the baseline (edit page, once the assignment is available). */
  const reset = useCallback((list: AssignmentAttachment[]) => {
    originalRef.current = list;
    itemsRef.current = list;
    committedRef.current = false;
    setItemsState(list);
    setDirty(false);
  }, []);

  const commit = useCallback(() => {
    const keep = new Set(itemsRef.current.map((i) => i.id));
    originalRef.current.forEach((o) => { if (!keep.has(o.id) && o.source === "upload") removeFile(o.ref); });
    originalRef.current = itemsRef.current;
    committedRef.current = true;
    setDirty(false);
  }, []);

  useEffect(() => () => {
    if (committedRef.current) return;
    itemsRef.current.forEach((i) => {
      if (i.source === "upload" && !originalRef.current.some((o) => o.id === i.id)) removeFile(i.ref);
    });
  }, []);

  return { items, dirty, setItems, reset, commit };
}

/** Put one picked file into mock storage and describe it as an attachment. */
async function storeAttachment(file: File): Promise<AssignmentAttachment> {
  const ref = await storeFile(file);
  return {
    id: crypto.randomUUID(),
    kind: file.type.startsWith("image/") ? "image" : "file",
    name: file.name,
    source: "upload",
    ref,
  };
}

const kindIcon = (kind: AssignmentAttachment["kind"]): IconName => (kind === "link" ? "link" : kind === "image" ? "image" : "file");

async function openAttachment(a: AssignmentAttachment) {
  if (a.source === "url") {
    window.open(a.ref, "_blank", "noopener,noreferrer");
    return;
  }
  const dataUrl = resolveFileUrl(a.ref);
  if (!dataUrl) return;
  // Top-level navigation to data: URLs is blocked by browsers — go through a Blob URL.
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  if (/^(image\/|application\/pdf|text\/)/.test(blob.type)) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function AttachmentChip({ a, onRemove, removeLabel }: { a: AssignmentAttachment; onRemove?: () => void; removeLabel?: string }) {
  const thumb = a.kind === "image" && typeof window !== "undefined" && a.source === "upload" ? resolveFileUrl(a.ref) : null;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
      <button
        type="button"
        onClick={() => void openAttachment(a)}
        className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
      >
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg"><img src={thumb} alt="" className="h-full w-full object-cover" /></span>
          : <IconTile icon={kindIcon(a.kind)} size="sm" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--text-primary)] truncate" title={a.name}>{a.name}</span>
          {a.kind === "link" && <span className="block text-xs text-[var(--text-muted)] truncate">{a.ref}</span>}
        </span>
      </button>
      {onRemove && (
        <IconButton icon="trash" label={removeLabel ?? "Remove"} tone="danger" onClick={onRemove} />
      )}
    </li>
  );
}

/** Read-only list, for the student brief and the teacher's assignment page. */
export function AttachmentList({ attachments, title }: { attachments?: AssignmentAttachment[]; title?: string }) {
  const { t } = useLanguage();
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{title ?? t("ไฟล์แนบ", "Attachments")} ({attachments.length})</p>
      <ul className="flex flex-col gap-2">
        {attachments.map((a) => <AttachmentChip key={a.id} a={a} />)}
      </ul>
    </div>
  );
}

/** Editor used inside the create/edit forms. Controlled by `useAttachmentsDraft`. */
export function AttachmentsEditor({ items, onChange }: {
  items: AssignmentAttachment[];
  onChange: (next: AssignmentAttachment[]) => void;
}) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const remaining = MAX_ATTACHMENTS - items.length;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(remaining, 0));
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    const added: AssignmentAttachment[] = [];
    try {
      for (const file of files) added.push(await storeAttachment(file));
    } catch (err) {
      setError(err instanceof FileTooLargeError
        ? t("ไฟล์ใหญ่เกินไป (จำกัด 2MB ต่อไฟล์สำหรับ mock storage)", "File too large (2MB per file mock storage limit)")
        : t("แนบไฟล์ไม่สำเร็จ (พื้นที่เก็บข้อมูลอาจเต็ม)", "Couldn't attach the file (storage may be full)"));
    } finally {
      setUploading(false);
      if (added.length > 0) onChange([...items, ...added]);
    }
  }

  function addLink() {
    const url = normalizeLinkUrl(linkUrl);
    if (!url) {
      setError(t("ลิงก์ไม่ถูกต้อง เช่น https://figma.com/file/...", "Invalid link, e.g. https://figma.com/file/..."));
      return;
    }
    setError(null);
    onChange([...items, { id: crypto.randomUUID(), kind: "link", name: linkTitle.trim() || url, source: "url", ref: url }]);
    setLinkUrl("");
    setLinkTitle("");
    setLinkOpen(false);
  }

  const btn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const input = "w-full px-3.5 py-2 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors";

  return (
    <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {t("ไฟล์แนบ / ตัวอย่างงาน", "Attachments / example work")}{" "}
        <span className="text-xs font-normal text-[var(--text-secondary)]">{t("(ไม่บังคับ)", "(optional)")}</span>
      </p>
      <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-3">
        {t("แนบไฟล์คำสั่งงาน รูปภาพ หรือลิงก์ตัวอย่างงานให้นักศึกษาเปิดดูได้", "Attach a brief, images, or a link to example work for students to open.")}
      </p>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2 mb-3" aria-label={t("รายการไฟล์แนบ", "Attached items")}>
          {items.map((a) => (
            <AttachmentChip
              key={a.id}
              a={a}
              removeLabel={t(`ลบ ${a.name}`, `Remove ${a.name}`)}
              onRemove={() => onChange(items.filter((x) => x.id !== a.id))}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={uploading || remaining <= 0} onClick={() => fileRef.current?.click()}>
          <Icon name="paperclip" size="sm" />
          {uploading ? t("กำลังแนบ...", "Attaching...") : t("แนบไฟล์ / รูปภาพ", "Attach file / image")}
        </button>
        <button type="button" className={btn} disabled={remaining <= 0} onClick={() => { setLinkOpen((v) => !v); setError(null); }} aria-expanded={linkOpen}>
          <Icon name="link" size="sm" />
          {t("เพิ่มลิงก์", "Add link")}
        </button>
        <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={handleFiles} aria-label={t("เลือกไฟล์แนบ", "Choose files to attach")} />
      </div>

      {linkOpen && (
        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 flex flex-col gap-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="https://..."
            aria-label={t("ลิงก์", "Link URL")}
            className={input}
            autoFocus
          />
          <input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="ชื่อที่แสดง (ไม่บังคับ)"
            aria-label={t("ชื่อที่แสดง", "Display name")}
            className={input}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setLinkOpen(false); setLinkUrl(""); setLinkTitle(""); setError(null); }} className="h-8 px-3 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button type="button" onClick={addLink} disabled={!linkUrl.trim()} className="h-8 px-3.5 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-medium hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {t("เพิ่ม", "Add")}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-[var(--s-err-text)] mt-2">{error}</p>}
      {remaining <= 0 && (
        <p className="text-xs text-[var(--text-secondary)] mt-2">{t(`แนบได้สูงสุด ${MAX_ATTACHMENTS} รายการ`, `Up to ${MAX_ATTACHMENTS} attachments`)}</p>
      )}
    </div>
  );
}

/**
 * Student-side file picker for a submission: every chosen file is listed with its own
 * remove button and more can be added until `max`. Controlled by `useAttachmentsDraft`,
 * so removed/abandoned uploads are freed from mock storage.
 */
export function SubmissionFilesPicker({ items, onChange, accept, label, max = MAX_ATTACHMENTS }: {
  items: AssignmentAttachment[];
  onChange: (next: AssignmentAttachment[]) => void;
  /** `accept` attribute for the file dialog, e.g. ".pdf,image/*". */
  accept?: string;
  label: string;
  max?: number;
}) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = max - items.length;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    const picked = files.slice(0, Math.max(remaining, 0));
    if (picked.length < files.length) {
      setError(t(`แนบได้สูงสุด ${max} ไฟล์`, `Up to ${max} files`));
    }
    setBusy(true);
    const added: AssignmentAttachment[] = [];
    try {
      for (const file of picked) added.push(await storeAttachment(file));
    } catch (err) {
      setError(err instanceof FileTooLargeError
        ? t("ไฟล์ใหญ่เกินไป (จำกัด 2MB ต่อไฟล์สำหรับ mock storage)", "File too large (2MB per file mock storage limit)")
        : t("แนบไฟล์ไม่สำเร็จ (พื้นที่เก็บข้อมูลอาจเต็ม)", "Couldn't attach the file (storage may be full)"));
    } finally {
      setBusy(false);
      if (added.length > 0) onChange([...items, ...added]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p id="submission-files-label" className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t("ไฟล์ที่เลือก", "Selected files")}>
          {items.map((a) => (
            <AttachmentChip
              key={a.id}
              a={a}
              removeLabel={t(`ลบ ${a.name}`, `Remove ${a.name}`)}
              onRemove={() => onChange(items.filter((x) => x.id !== a.id))}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || remaining <= 0}
          className="h-8 px-3 rounded-lg bg-[var(--accent-bright)]/10 text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-bright)]/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
        >
          {busy
            ? t("กำลังแนบ...", "Attaching...")
            : items.length > 0 ? t("เพิ่มไฟล์อีก", "Add another file") : t("เลือกไฟล์", "Choose file")}
        </button>
        {items.length === 0 && !busy && (
          <span className="text-xs text-[var(--text-muted)]">{t("ยังไม่ได้เลือกไฟล์", "No file chosen")}</span>
        )}
        {items.length > 0 && (
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{items.length} / {max}</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleFiles}
        aria-labelledby="submission-files-label"
      />

      {error && <p role="alert" className="text-xs text-[var(--s-err-text)]">{error}</p>}
    </div>
  );
}
