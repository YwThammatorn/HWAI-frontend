import type { CSSProperties } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { CourseIcon, type CourseIconKey } from "@/components/CourseIcon";

/**
 * The tinted box an icon sits in (23/10/2569). Before this every screen cut its own: nine box sizes (28–72px), four corner radii, and the
 * same "empty" icon in three different greys. Now there are three sizes, one radius per size, a fixed icon size per box, and named tones.
 *
 *   size  sm 36px · icon sm — beside a label, in a stat header, a file tile
 *         md 45px · icon lg — the leading mark of a row, card or dialog (and a course's own icon)
 *         lg 54px · icon xl — an empty state or a "done" mark in the middle of a panel
 *   shape square (default; corners follow the size) · round — for a status mark (done, suspended, deleted)
 *   tone  accent · ok · warn · err · info · ta · neutral (quiet grey: empty states) · onDark (frosted, on a coloured banner) · brand (bright teal on the dark brand panel) · cover (a course's own colour)
 *
 * `icon` is a name from components/Icon.tsx, or `course` for a teacher-picked CourseIcon key. The box is decorative (aria-hidden).
 */
export type IconTileTone = "accent" | "ok" | "warn" | "err" | "info" | "ta" | "neutral" | "onDark" | "brand" | "cover";
export type IconTileSize = "sm" | "md" | "lg";

const BOX: Record<IconTileSize, { box: string; radius: string; icon: "sm" | "lg" | "xl" }> = {
  sm: { box: "h-8 w-8", radius: "rounded-lg", icon: "sm" },
  md: { box: "h-10 w-10", radius: "rounded-xl", icon: "lg" },
  lg: { box: "h-12 w-12", radius: "rounded-2xl", icon: "xl" },
};

const TONE: Record<IconTileTone, string> = {
  accent: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  ok: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]",
  warn: "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)]",
  err: "bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
  info: "bg-[var(--s-info-bg)] text-[var(--s-info-text)]",
  ta: "bg-[var(--role-ta-bg)] text-[var(--role-ta-text)]",
  neutral: "bg-[var(--bg-app)] text-[var(--text-muted)]",
  onDark: "bg-white/20 text-white backdrop-blur-sm",
  brand: "bg-white/10 text-[var(--brand-bright)]",
  cover: "text-white",
};

export default function IconTile({ icon, course, size = "sm", shape = "square", tone = "accent", spin, className = "", style }: {
  icon?: IconName;
  /** a course's own icon (CourseIconKey) instead of a named glyph */
  course?: CourseIconKey;
  size?: IconTileSize;
  shape?: "square" | "round";
  tone?: IconTileTone;
  spin?: boolean;
  className?: string;
  /** for tone="cover": `{ background: course.coverColor }` */
  style?: CSSProperties;
}) {
  const b = BOX[size];
  return (
    <span aria-hidden="true" style={style} className={`inline-flex shrink-0 items-center justify-center ${b.box} ${shape === "round" ? "rounded-full" : b.radius} ${TONE[tone]} ${className}`}>
      {course !== undefined || !icon
        ? <CourseIcon iconKey={course} size={b.icon} />
        : <Icon name={icon} size={b.icon} className={spin ? "animate-spin" : undefined} />}
    </span>
  );
}
