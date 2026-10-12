"use client";

import type { CLO } from "@/lib/clo";

/**
 * Small "CLO1 · CLO3" tags for a rubric criterion — the teacher sees which learning outcomes a criterion measures.
 * Hover shows the CLO's full text (the codes are enough to read the row; the text is the extra).
 */
export default function CloChips({ cloIds, clos }: { cloIds?: string[]; clos: Pick<CLO, "id" | "code" | "text">[] }) {
  const items = (cloIds ?? []).map((id) => clos.find((c) => c.id === id)).filter((c): c is Pick<CLO, "id" | "code" | "text"> => !!c);
  if (items.length === 0) return null;
  return (
    <span data-testid="clo-chips" className="inline-flex flex-wrap items-center gap-1">
      {items.map((c) => (
        <span key={c.id} title={c.text} className="inline-flex h-5 items-center rounded-md border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-1.5 text-[10px] font-semibold text-[var(--s-info-text)]">
          {c.code}
        </span>
      ))}
    </span>
  );
}
