import type { ReactNode } from "react";
import { CourseIcon, type CourseIconKey } from "@/components/CourseIcon";

// Cover colours are user data (a preset from the picker, or any colour a seed/mock
// course carries), so the text tone can't be fixed in CSS: pick whichever of
// white / deep navy has the higher WCAG contrast against the actual cover.
const DARK_INK = "#0F1E2E";

function luminance(hex: string): number | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function coverTone(cover: string): "light" | "dark" {
  const lum = luminance(cover);
  if (lum === null) return "light";
  const whiteContrast = 1.05 / (lum + 0.05);
  const inkContrast = (lum + 0.05) / (luminance(DARK_INK)! + 0.05);
  return whiteContrast >= inkContrast ? "light" : "dark";
}

/**
 * Colour band at the top of a course card (My Courses — teacher and student):
 * icon chip, course code and name on one row at the bottom of the cover colour.
 * `overlay` is rendered over the whole band (e.g. the "Archived" veil).
 */
export default function CourseBanner({ coverColor, icon, name, code, overlay }: {
  coverColor: string;
  icon?: CourseIconKey;
  name: string;
  code?: string;
  overlay?: ReactNode;
}) {
  const onLight = coverTone(coverColor) === "light";
  return (
    <div
      data-course-banner
      className="relative h-40 shrink-0 flex items-end p-4"
      style={{ background: coverColor, color: onLight ? "#FFFFFF" : DARK_INK }}
    >
      {/* icon sits on the same row as the code + name, centred against them */}
      <div className="flex items-center gap-3 w-full min-w-0">
        <div
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
          style={{ background: onLight ? "rgba(255,255,255,0.22)" : "rgba(15,30,46,0.12)" }}
        >
          <CourseIcon iconKey={icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          {code && <p className="text-xs font-semibold tracking-wide tabular-nums truncate mb-0.5">{code}</p>}
          <h3 className="font-bold text-base leading-snug line-clamp-2">{name}</h3>
        </div>
      </div>
      {overlay}
    </div>
  );
}
