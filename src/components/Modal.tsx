"use client";

import { useEffect, useId, useRef, useState, ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";

const SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Centred popup used for "add" / "import" forms (replaces the right-hand drawers).
 * Backdrop click and Esc close it, Tab stays inside it, and focus goes back to
 * whatever opened it. Put the form (with its own Cancel / Submit row) in `children`.
 */
export default function Modal({ open, onClose, title, description, size = "md", footer, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZE;
  /** Action row (Cancel + Primary) pinned below the scrolling body. Omit when the form carries its own. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Remember what had focus when the popup opened. This has to happen while rendering:
  // by the time effects run, a field's autoFocus has already taken focus away from it.
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && typeof document !== "undefined") setOpener(document.activeElement as HTMLElement | null);
  }

  // Focus: into the first field on open, back to the opener on close
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    // a control with autoFocus has already taken focus
    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>("input:not([disabled]),select,textarea") ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    return () => { opener?.focus?.(); };
  }, [open, opener]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  if (!open) return null;

  return (
    <>
      {/* z above the sticky top bar (z-50) so the popup covers the whole page and nothing behind it is clickable */}
      <div className="hwai-modal-overlay fixed inset-0 bg-black/40 z-[60]" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={trapTab}
        className={`hwai-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[calc(100%-2rem)] ${SIZE[size]} max-h-[90vh] flex flex-col bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)]`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
            {description && <p id={descId} className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ปิด", "Close")}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0">{footer}</div>
        )}
      </div>
    </>
  );
}
