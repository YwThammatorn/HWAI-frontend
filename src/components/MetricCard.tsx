import Icon, { type IconName } from "@/components/Icon";

/**
 * One summary figure with a label, a unit line and an icon (23/10/2569) — the four cards on an assignment's Grading page and on its Results page.
 *
 * Before this each card brought its own icon: a check in a tinted circle, a bare file icon, a warning in a tinted square, a bare star — four
 * shapes and three sizes — and the cards with the taller icon pushed their number lower than the others. Here the icon always sits in the same
 * tinted tile of fixed size, in a header row of fixed height, so every number lands on the same line and every icon has the same weight.
 *
 *   tone   ok · warn · info · accent · neutral · rating — picks the tile colours (and the number's colour for ok / warn / accent)
 *   icon   a name from components/Icon.tsx (a rating star is `filled`)
 */
export type MetricTone = "ok" | "warn" | "info" | "accent" | "neutral" | "rating";

const TONES: Record<MetricTone, { tile: string; icon: string; value: string }> = {
  ok: { tile: "bg-[var(--s-ok-bg)]", icon: "text-[var(--s-ok-text)]", value: "text-[var(--s-ok-text)]" },
  warn: { tile: "bg-[var(--s-warn-bg)]", icon: "text-[var(--s-warn-text)]", value: "text-[var(--s-warn-text)]" },
  info: { tile: "bg-[var(--s-info-bg)]", icon: "text-[var(--s-info-text)]", value: "text-[var(--text-primary)]" },
  accent: { tile: "bg-[var(--accent-subtle)]", icon: "text-[var(--accent)]", value: "text-[var(--accent)]" },
  neutral: { tile: "bg-[var(--bg-app)]", icon: "text-[var(--text-secondary)]", value: "text-[var(--text-primary)]" },
  rating: { tile: "bg-[var(--s-warn-bg)]", icon: "text-[var(--rating-fill)]", value: "text-[var(--text-primary)]" },
};

export default function MetricCard({ label, value, sub, icon, tone, filled }: {
  label: string;
  value: string | number;
  /** The unit / context beside the number, e.g. "completed", "of 10 · Max 9 · Min 4". */
  sub: string;
  icon: IconName;
  tone: MetricTone;
  filled?: boolean;
}) {
  const c = TONES[tone];
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.tile}`}>
          <Icon name={icon} size="sm" filled={filled} className={c.icon} />
        </span>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>
        {value}{" "}
        <span className="text-sm font-normal text-[var(--text-muted)]">{sub}</span>
      </p>
    </div>
  );
}
