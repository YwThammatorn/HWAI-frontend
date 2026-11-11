"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import Icon, { type IconName } from "@/components/Icon";

/**
 * A button that is only an icon (23/10/2569) — the edit / delete / close marks in rows, headers and dialogs.
 * Before this they were 28, 31 and 36px boxes with icons from 12 to 20px, some with no box at all. Now: a 36px box, a 14px icon, always visible
 * (never hover-only), and a required `label` that is both the accessible name and the tooltip.
 *
 *   tone  default (hover: accent) · danger (hover: red) · warn (hover: amber) · onDark (on the teal top bar)
 * Pass `href` for a link that looks the same.
 */
export type IconButtonTone = "default" | "danger" | "warn" | "onDark";

const TONE: Record<IconButtonTone, string> = {
  default: "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10",
  danger: "text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)]",
  warn: "text-[var(--text-muted)] hover:text-[var(--s-warn-text)] hover:bg-[var(--s-warn-bg)]",
  onDark: "text-white/70 hover:text-white hover:bg-white/10",
};

export default function IconButton({ icon, label, tone = "default", dense, round, iconClassName, onClick, href, disabled, type = "button", className = "", ...rest }: {
  icon: IconName;
  label: string;
  tone?: IconButtonTone;
  /** 27px with a 12px icon — only for a dense table cell (the Score Book), where a 36px box would make every row taller */
  dense?: boolean;
  /** a circle instead of rounded corners — only for pagination, whose numbered buttons are circles */
  round?: boolean;
  /** for a chevron that turns (rotate-180) */
  iconClassName?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  "data-testid"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean | "menu" | "listbox" | "dialog";
  "aria-pressed"?: boolean;
}) {
  const cls = `inline-flex ${dense ? "h-6 w-6" : "h-8 w-8"} shrink-0 items-center justify-center ${round ? "rounded-full" : "rounded-lg"} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] disabled:opacity-40 disabled:pointer-events-none ${TONE[tone]} ${className}`;
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={cls} {...rest}>
        <Icon name={icon} size={dense ? "xs" : "sm"} className={iconClassName} />
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cls} {...rest}>
      <Icon name={icon} size={dense ? "xs" : "sm"} className={iconClassName} />
    </button>
  );
}
