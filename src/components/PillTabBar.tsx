"use client";

export type PillTabTone = "ok" | "warn" | "info" | "err" | "neutral";

interface PillTab {
  key: string;
  label: string;
  count?: number;
  /** boxed variant only: colours the count chip with the matching status tokens (text + bg + border). */
  tone?: PillTabTone;
}

interface PillTabBarProps {
  tabs: PillTab[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  /**
   * "pill" (default): one grey track holding the tabs — fine for a top-level switch.
   * "boxed": every tab is its own bordered box with a gap between them, so each one reads as a button;
   * for filters inside a card, where the grey track blended into the card and nothing looked clickable.
   */
  variant?: "pill" | "boxed";
}

// Same pale -bg + readable -text + visible -bd trio as every other status chip (DESIGN.md §6 / §9b).
const TONE: Record<PillTabTone, string> = {
  ok: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]",
  warn: "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] border-[var(--s-warn-bd)]",
  info: "bg-[var(--s-info-bg)] text-[var(--s-info-text)] border-[var(--s-info-bd)]",
  err: "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border-[var(--s-err-bd)]",
  neutral: "bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border)]",
};

export default function PillTabBar({ tabs, activeKey, onChange, ariaLabel, variant = "pill" }: PillTabBarProps) {
  if (variant === "boxed") {
    return (
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={ariaLabel}>
        {tabs.map(({ key, label, count, tone }) => {
          const active = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={[
                "inline-flex h-11 items-center gap-2.5 rounded-xl border-2 pl-4 pr-3 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:ring-offset-1",
                active
                  // text-primary, not accent: accent on accent-subtle is 4.40:1 in dark mode (under 4.5)
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                  : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm hover:border-[var(--accent-bright)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {/* a tick on the selected box, so "selected" never rests on colour alone */}
              {active && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {label}
              {count !== undefined && (
                <span className={`min-w-7 rounded-lg border px-2 py-0.5 text-center text-xs font-bold tabular-nums ${TONE[tone ?? "neutral"]}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="inline-flex gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ key, label, count }) => {
        const active = key === activeKey;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={[
              "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]",
              active
                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                // text-muted fails WCAG AA against this bar's own bg-subtle background
                // (4.26:1 light / 4.11:1 dark, both under 4.5:1) — text-secondary passes
                // both (5.19:1 / 4.67:1), verified by hand since these two colors were
                // never checked against this specific background before.
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {label}
            {count !== undefined && (
              <span
                className={[
                  "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md",
                  active
                    ? "bg-[var(--accent-bright)]/10 text-[var(--accent)]"
                    : "bg-[var(--border-subtle)] text-[var(--text-secondary)]",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
