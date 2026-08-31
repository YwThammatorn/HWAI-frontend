import React from "react";

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export default function StatCard({ label, value, color, bg, icon, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`flex-1 min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4 flex items-center gap-4 transition-colors${onClick ? " cursor-pointer hover:border-[#2DD4BF]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]" : ""}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)" }}
    >
      <div
        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: bg }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}
