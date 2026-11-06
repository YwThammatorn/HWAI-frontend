import type { ReactNode, SVGProps } from "react";

/**
 * The one icon component of HWAI (22/10/2569). Every icon in the app comes from here — never an inline <svg> in a page.
 *
 * Why: before this there were 355 hand-pasted SVGs with 5 stroke widths (1.5 / 1.8 / 2 / 2.5 / 3), 8+ sizes and hard-coded colours, so no
 * two screens drew the same icon the same way. Here the grid (24), stroke (2, round caps and joins), sizes (5) and colour (currentColor) are fixed.
 *
 * Use: <Icon name="check" size="sm" className="text-[var(--s-ok-text)]" />
 *   size   xs 12 (inside small chips and badges) · sm 14 (next to 14px text, table cells, row actions) · md 16 (default: buttons, sidebar) · lg 20 (stat cards, section headers) · xl 24 (empty states)
 *   colour comes from the text colour (currentColor) — set it with a token class, never a hex value
 *   `filled` fills the glyph with the same colour (a rating star, a play button)
 *   decorative by default (aria-hidden); pass `label` only for an icon that stands alone with no text next to it
 * A new glyph = add one entry below (24 × 24 grid, outline, no stroke or fill attributes on the shapes), then use it by name.
 * Rules and the reason for each: DESIGN.md "Icons". tests/design-rules.spec.ts fails on an inline <svg> outside the few art / logo files it lists.
 */
export const ICON_SIZES = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;
export type IconSize = keyof typeof ICON_SIZES;
export const ICON_STROKE = 2;

const ICONS = {
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
      <line x1="12" y1="8" x2="12" y2="12" />
    </>
  ),
  "alert-triangle": (
    <>
      <line x1="12" y1="17" x2="12.01" y2="17" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </>
  ),
  "align-center": (
    <>
      <line x1="11" y1="18" x2="13" y2="18" />
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  archive: (
    <>
      <line x1="10" y1="12" x2="14" y2="12" />
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
    </>
  ),
  "arrow-left": (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  "arrow-right": (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </>
  ),
  "bar-chart": (
    <>
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  bell: (
    <>
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  calendar: (
    <>
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  "check-square": (
    <>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      <polyline points="9 11 12 14 22 4" />
    </>
  ),
  "chevron-down": <polyline points="6 9 12 15 18 9" />,
  "chevron-left": <polyline points="15 18 9 12 15 6" />,
  "chevron-right": <polyline points="9 18 15 12 9 6" />,
  "chevron-up": <polyline points="18 15 12 9 6 15" />,
  "clipboard-check": (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </>
  ),
  "clipboard-list": (
    <>
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  "document-list": (
    <>
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <rect x="5" y="2" width="14" height="20" rx="2" />
    </>
  ),
  download: (
    <>
      <line x1="12" y1="15" x2="12" y2="3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  "external-link": (
    <>
      <line x1="10" y1="14" x2="21" y2="3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
    </>
  ),
  eye: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    </>
  ),
  "eye-off": (
    <>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  "file-download": (
    <>
      <line x1="12" y1="18" x2="12" y2="12" />
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="9 15 12 18 15 15" />
    </>
  ),
  "file-plus": (
    <>
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  "file-text": (
    <>
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="10 9 9 9 8 9" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  "graduation-cap": (
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  history: (
    <>
      <path d="M12 7v5l3 2" />
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 3 3 9 9 9" />
    </>
  ),
  home: (
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  hourglass: (
    <>
      <path d="M5 3h14l-2 7H7L5 3z" />
      <path d="M7 10l-2 11h14L17 10" />
    </>
  ),
  image: (
    <>
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  "layout-grid": (
    <>
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="3" width="7" height="7" rx="1" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  lock: (
    <>
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </>
  ),
  "log-out": (
    <>
      <line x1="21" y1="12" x2="9" y2="12" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
    </>
  ),
  mail: (
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ),
  maximize: (
    <>
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    </>
  ),
  megaphone: (
    <>
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
    </>
  ),
  "message-square": <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  "more-vertical": (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
      <circle cx="12" cy="5" r="1.6" />
    </>
  ),
  paperclip: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  play: <polygon points="5 3 19 12 5 21 5 3" />,
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
    </>
  ),
  "rotate-ccw": (
    <>
      <path d="M3.51 15a9 9 0 1 0 .49-3.34" />
      <polyline points="1 4 1 10 7 10" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  sliders: (
    <>
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="17" y1="16" x2="23" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  table: (
    <>
      <line x1="15" y1="10" x2="15" y2="20" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="10" x2="9" y2="20" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="12" r="6" />
    </>
  ),
  trash: (
    <>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <polyline points="3 6 5 6 21 6" />
    </>
  ),
  "trending-up": (
    <>
      <polyline points="17 6 23 6 23 12" />
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    </>
  ),
  upload: (
    <>
      <line x1="12" y1="3" x2="12" y2="15" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    </>
  ),
  video: (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,

  "arrow-up": (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  ),
  "arrow-down": (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </>
  ),
  "chevrons-up-down": (
    <>
      <polyline points="8 9 12 5 16 9" />
      <polyline points="8 15 12 19 16 15" />
    </>
  ),
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
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
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

type Props = Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "viewBox" | "fill" | "stroke" | "strokeWidth"> & {
  name: IconName;
  size?: IconSize;
  filled?: boolean;
  /** Accessible name for an icon that is the only thing in its control or line. Leave out when text sits next to it. */
  label?: string;
};

export default function Icon({ name, size = "md", filled = false, label, className, ...rest }: Props) {
  const px = ICON_SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={`shrink-0${className ? " " + className : ""}`}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
