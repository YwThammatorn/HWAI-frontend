"use client";

import IconButton from "@/components/IconButton";
import { useLanguage } from "@/context/LanguageContext";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Spacing around it. Default `mt-8` (under a list); pass "" when it sits inside a footer row. */
  className?: string;
}

/** Which page buttons to draw: every page up to 5, otherwise the first, the last and the ones around the current page, with … between. */
function windowed(page: number, total: number): (number | "…")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, "…", total];
  if (page >= total - 2) return [1, "…", total - 2, total - 1, total];
  return [1, "…", page - 1, page, page + 1, "…", total];
}

export default function Pagination({ page, totalPages, onChange, className = "mt-8" }: PaginationProps) {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <div className={`flex justify-center items-center gap-1 ${className}`}>
      <IconButton icon="chevron-left" round label={t("หน้าก่อนหน้า", "Previous page")} onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} />
      {windowed(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="flex h-8 w-8 items-center justify-center text-sm text-[var(--text-muted)]">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={["w-8 h-8 rounded-full text-sm font-medium transition-colors", p === page ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"].join(" ")}
          >
            {p}
          </button>
        )
      )}
      <IconButton icon="chevron-right" round label={t("หน้าถัดไป", "Next page")} onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
    </div>
  );
}
