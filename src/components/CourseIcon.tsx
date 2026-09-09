export type CourseIconKey = "book" | "chart" | "flask" | "code" | "palette" | "laptop" | "graduation" | "globe";

export const COURSE_ICON_KEYS: CourseIconKey[] = ["book", "chart", "flask", "code", "palette", "laptop", "graduation", "globe"];

const PATHS: Record<CourseIconKey, React.ReactNode> = {
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  chart: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  flask: (
    <>
      <path d="M9 2v6L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 8V2" />
      <path d="M9 2h6" />
      <path d="M7 14h10" />
    </>
  ),
  code: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  palette: (
    <>
      <path d="M12 2a10 9 0 0 0 0 20 5 5 0 0 0 0-10h3a2 2 0 0 0 2-2c0-4.4-4.5-8-9-8z" />
      <circle cx="13.5" cy="6.5" r=".6" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".6" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".6" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".6" fill="currentColor" />
    </>
  ),
  laptop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </>
  ),
  graduation: (
    <>
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12.5V17c0 1 3 3 6 3s6-2 6-3v-4.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </>
  ),
};

export function CourseIcon({
  iconKey,
  size = 18,
  className,
}: {
  iconKey?: CourseIconKey;
  size?: number;
  className?: string;
}) {
  const key = iconKey && PATHS[iconKey] ? iconKey : "book";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[key]}
    </svg>
  );
}
