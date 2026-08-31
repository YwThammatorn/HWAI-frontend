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
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]",
              active
                ? "bg-[var(--bg-surface)] text-[#0F766E] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {label}
            {count !== undefined && (
              <span
                className={[
                  "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md",
                  active
                    ? "bg-[#0F766E]/10 text-[#0F766E]"
                    : "bg-[var(--border-subtle)] text-[var(--text-muted)]",
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
