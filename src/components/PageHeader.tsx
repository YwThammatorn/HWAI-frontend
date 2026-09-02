"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="pl-4" style={{ borderLeft: "3px solid #2DD4BF" }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
