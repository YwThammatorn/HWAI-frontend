import type { CSSProperties } from "react";

/**
 * A person's circle with their initials (23/10/2569). Before this each page drew its own: 28, 31, 36 and 45px circles, initials from 10 to 16px,
 * the fill a hex, a one-off class or a style prop. Now two sizes and four tones.
 *
 *   size  sm 36px · 14px initials (rows, tables, the top bar) · md 45px · 16px initials (a person's header, a dialog)
 *   tone  accent (default: soft teal — people in a list) · solid (white on `bg`: a person with their own colour, a role) ·
 *         muted (grey — not yet chosen / not assigned) · brand (bright teal with the logo navy — the signed-in user in the top bar)
 *   bg    only for tone="solid": any token colour, e.g. "var(--cat-3)" · "var(--role-ta-text)" · "var(--accent-solid)"
 */
export type AvatarTone = "accent" | "solid" | "muted" | "brand";

const TONE: Record<AvatarTone, string> = {
  accent: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  solid: "text-[var(--cover-ink-light)]",
  muted: "bg-[var(--bg-app)] text-[var(--text-secondary)]",
  brand: "bg-[var(--brand-bright)] text-[var(--brand-ink)]",
};

export default function Avatar({ initials, size = "sm", tone, bg, className = "", style }: {
  initials: string;
  size?: "sm" | "md";
  tone?: AvatarTone;
  bg?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const t: AvatarTone = tone ?? (bg ? "solid" : "accent");
  return (
    <span
      aria-hidden="true"
      style={t === "solid" && bg ? { background: bg, ...style } : style}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold leading-none ${size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"} ${TONE[t]} ${className}`}
    >
      {initials}
    </span>
  );
}
