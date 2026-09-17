"use client";

import type { ReactNode } from "react";

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

export default function FilterSelect({
  value,
  onChange,
  icon,
  ariaLabel,
  children,
  className = "",
}: FilterSelectProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-9 min-w-[8.5rem] pl-8 pr-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] whitespace-nowrap appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)] transition-colors"
      >
        {children}
      </select>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
