import Icon, { type IconName } from "@/components/Icon";

/**
 * One summary figure with a label, a unit line and an icon (23/10/2569) — the four cards on an assignment's Grading page and on its Results page.
 *
 * Before this each card brought its own icon: a check in a tinted circle, a bare file icon, a warning in a tinted square, a bare star — four
 * shapes and three sizes — and the cards with the taller icon pushed their number lower than the others. Here the icon always sits in the same
 * tinted tile of fixed size, in a header row of fixed height, so every number lands on the same line and every icon has the same weight.
 *
 *   parts  (optional) two or three small blocks instead of one value + unit line, e.g. Average · Highest · Lowest — each a number with its caption under it (so the number sits on the same line as the other cards' numbers), the first one emphasised
 *   tone   ok · warn · info · accent · neutral · rating — picks the tile colours (and the number's colour for ok / warn / accent)
 *   icon   a name from components/Icon.tsx — always an outline, in the tone's own text colour (the rating star too)
 */
export type MetricTone = "ok" | "warn" | "info" | "accent" | "neutral" | "rating";

const TONES: Record<MetricTone, { tile: string; icon: string; value: string }> = {
  ok: { tile: "bg-[var(--s-ok-bg)]", icon: "text-[var(--s-ok-text)]", value: "text-[var(--s-ok-text)]" },
  warn: { tile: "bg-[var(--s-warn-bg)]", icon: "text-[var(--s-warn-text)]", value: "text-[var(--s-warn-text)]" },
  info: { tile: "bg-[var(--s-info-bg)]", icon: "text-[var(--s-info-text)]", value: "text-[var(--text-primary)]" },
  accent: { tile: "bg-[var(--accent-subtle)]", icon: "text-[var(--accent)]", value: "text-[var(--accent)]" },
  neutral: { tile: "bg-[var(--bg-app)]", icon: "text-[var(--text-secondary)]", value: "text-[var(--text-primary)]" },
  rating: { tile: "bg-[var(--s-warn-bg)]", icon: "text-[var(--s-warn-text)]", value: "text-[var(--text-primary)]" },
};

export default function MetricCard({ label, value, sub, parts, icon, tone }: {
  label: string;
  value?: string | number;
  /** The unit / context beside the number, e.g. "completed", "of 10 · Max 9 · Min 4". */
  sub?: string;
  /** Three small blocks (caption over number) in place of value + sub. */
  parts?: { label: string; value: string | number }[];
  icon: IconName;
  tone: MetricTone;
}) {
  const c = TONES[tone];
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.tile}`}>
          <Icon name={icon} size="sm" className={c.icon} />
        </span>
      </div>
      {parts ? (
        <dl className="grid" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
          {parts.map((p, i) => (
            <div key={p.label} className={`flex flex-col-reverse ${i === 0 ? "pr-3" : "border-l border-[var(--border-subtle)] px-3"}`}>
              <dt className="text-xs font-medium text-[var(--text-muted)]">{p.label}</dt>
              <dd className={`text-2xl font-bold tabular-nums ${i === 0 ? c.value : "text-[var(--text-secondary)]"}`}>{p.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={`text-2xl font-bold ${c.value}`}>
          {value}{" "}
          <span className="text-sm font-normal text-[var(--text-muted)]">{sub}</span>
        </p>
      )}
    </div>
  );
}
