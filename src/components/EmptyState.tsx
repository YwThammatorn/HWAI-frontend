"use client";

import React from "react";
import IconTile from "@/components/IconTile";
import type { IconName } from "@/components/Icon";

interface EmptyStateProps {
  /** a glyph name from components/Icon.tsx — drawn in the shared IconTile (lg, accent) */
  icon: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 px-8 text-center">
      <IconTile icon={icon} size="lg" tone="accent" className="mb-3" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
