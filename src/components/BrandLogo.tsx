import type { SVGProps } from "react";

/**
 * HWAI's own mark and the two third-party sign-in logos (22/10/2569). These are the only artwork SVGs that are not UI icons, so they live
 * here instead of being pasted into the pages (the logo was copied into 7 places, each with its own hex colours). UI icons are never drawn
 * here — they come from components/Icon.tsx.
 */

/** The four squares. Draws in the text colour (currentColor); the fourth square is softer. */
export function BrandMark({ size, ...rest }: Omit<SVGProps<SVGSVGElement>, "viewBox" | "fill"> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...rest}>
      <rect x="2" y="2" width="6" height="6" rx="1" fillOpacity="0.9" />
      <rect x="10" y="2" width="6" height="6" rx="1" fillOpacity="0.9" />
      <rect x="2" y="10" width="6" height="6" rx="1" fillOpacity="0.9" />
      <rect x="10" y="10" width="6" height="6" rx="1" fillOpacity="0.6" />
    </svg>
  );
}

/**
 * Tile + mark + "HWAI Agent".
 *   size  sm = the top bars (Navbar, AdminShell, StudentShell) · lg = the sign-in and register pages
 *   tone  onDark = on the teal brand panel / top bar (white mark and name) · onLight = on a light page (dark mark and name)
 */
export default function BrandLogo({ size = "sm", tone = "onDark" }: { size?: "sm" | "lg"; tone?: "onDark" | "onLight" }) {
  const big = size === "lg";
  return (
    <span className={`flex items-center ${big ? "gap-2.5" : "gap-2"}`}>
      <span className={`flex shrink-0 items-center justify-center bg-[var(--brand-bright)] ${big ? "h-9 w-9 rounded-xl" : "h-8 w-8 rounded-lg"}`}>
        <BrandMark size={big ? 20 : 18} className={tone === "onDark" ? "text-white" : "text-[var(--navbar-bg)]"} />
      </span>
      <span className={`font-bold tracking-tight ${big ? "text-[17px]" : "text-[15px]"} ${tone === "onDark" ? "text-white" : "text-[var(--text-primary)]"}`}>HWAI Agent</span>
    </span>
  );
}

export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
