"use client";

interface PillTab {
  key: string;
  label: string;
  count?: number;
}

interface PillTabBarProps {
  tabs: PillTab[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}

export default function PillTabBar({ tabs, activeKey, onChange, ariaLabel }: PillTabBarProps) {
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
