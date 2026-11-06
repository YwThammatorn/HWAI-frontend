import Icon, { type IconName, type IconSize } from "@/components/Icon";

/** The icons a teacher can give a course. Each key is one glyph of the shared icon set (components/Icon.tsx) — nothing is drawn here. */
export type CourseIconKey = "book" | "chart" | "flask" | "code" | "palette" | "laptop" | "graduation" | "globe";

export const COURSE_ICON_KEYS: CourseIconKey[] = ["book", "chart", "flask", "code", "palette", "laptop", "graduation", "globe"];

const GLYPH: Record<CourseIconKey, IconName> = {
  book: "book",
  chart: "bar-chart",
  flask: "flask",
  code: "code",
  palette: "palette",
  laptop: "laptop",
  graduation: "graduation-cap",
  globe: "globe",
};

export function CourseIcon({
  iconKey,
  size = "lg",
  className,
}: {
  iconKey?: CourseIconKey;
  size?: IconSize;
  className?: string;
}) {
  return <Icon name={GLYPH[iconKey && GLYPH[iconKey] ? iconKey : "book"]} size={size} className={className} />;
}
