"use client";

import { useEffect, useId, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";

import Icon from "@/components/Icon";
import IconButton from "@/components/IconButton";
const SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" } as const;

// Popups can open popups (the rubric editor in a popup has its own picker and AI assistant, 14/10/2569). Each one is drawn on <body>, not
// inside the popup that opened it — a transformed parent would otherwise become the containing block of a `fixed` child and clip it — and
// only the newest open one answers Esc.
const openStack: string[] = [];

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
    openStack.push(titleId);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openStack[openStack.length - 1] === titleId) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = openStack.lastIndexOf(titleId);
      if (at >= 0) openStack.splice(at, 1);
    };
  }, [open, onClose, titleId]);

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    e.stopPropagation();   // a popup inside this one must not have its Tab handled by this one as well
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
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
          <IconButton icon="x" label={t("ปิด", "Close")} onClick={onClose} />
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0">{footer}</div>
        )}
      </div>
    </>,
    document.body,
  );
}
