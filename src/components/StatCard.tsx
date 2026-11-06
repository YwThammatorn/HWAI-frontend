import React from "react";
import IconTile, { type IconTileTone } from "@/components/IconTile";
import type { IconName } from "@/components/Icon";

/**
 * A count with its icon, laid out as icon-left (admin pages, the grading queue, results). Its twin with the icon at the top right and a unit line
 * is MetricCard. Both draw the icon in the same IconTile and take the same tones, so a green "graded" card is the same green everywhere.
 * (Before 23/10/2569 this took a `color` and a `bg` string — and two admin pages passed raw rgba blues instead of the info tokens.)
 */
const VALUE_COLOR: Partial<Record<IconTileTone, string>> = {
  accent: "var(--accent)", ok: "var(--s-ok-text)", warn: "var(--s-warn-text)", info: "var(--s-info-text)", err: "var(--s-err-text)", ta: "var(--role-ta-text)",
};

interface StatCardProps {
  label: string;
  value: number;
  tone: Extract<IconTileTone, "accent" | "ok" | "warn" | "info" | "err" | "ta" | "neutral">;
  icon: IconName;
  onClick?: () => void;
  /** Appended to the number, e.g. "%". */
  suffix?: string;
}

export default function StatCard({ label, value, tone, icon, onClick, suffix }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`flex-1 min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4 flex items-center gap-4 transition-colors${onClick ? " cursor-pointer hover:border-[var(--accent-bright)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]" : ""}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)" }}
    >
      <IconTile icon={icon} size="md" tone={tone} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: VALUE_COLOR[tone] ?? "var(--text-primary)" }}>
          {value}{suffix}
        </p>
      </div>
    </div>
  );
}
