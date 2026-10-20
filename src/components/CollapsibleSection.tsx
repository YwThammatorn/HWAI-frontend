"use client";

import { ReactNode, useId } from "react";

/**
 * A titled group that folds away (14/10/2569) — the student's classwork list is long, so only the groups that need action stay open.
 * Controlled: the page decides which groups are open (and remembers it). The title is a real button inside the heading, so it works with
 * the keyboard and a screen reader hears "expanded" / "collapsed" and how many items are inside.
 */
export default function CollapsibleSection({ title, count, open, onToggle, toneClass = "text-[var(--text-muted)]", testId, children }: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** text colour of the heading (the page uses red for overdue, amber for due soon …) */
  toneClass?: string;
  testId?: string;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <section data-testid={testId}>
      <h2 className="mb-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`group inline-flex items-center gap-2 rounded-lg px-1 -ml-1 py-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${toneClass}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>{title} ({count})</span>
        </button>
      </h2>
      {open && <div id={bodyId} className="flex flex-col gap-3">{children}</div>}
    </section>
  );
}
