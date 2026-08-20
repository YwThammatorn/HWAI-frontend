import Link from "next/link";
import AppShell from "@/components/AppShell";

export default function NotFound() {
  return (
    <AppShell>
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="flex items-center gap-16 max-w-4xl w-full">

          {/* Illustration */}
          <div className="relative flex-shrink-0 w-72 h-72 flex items-center justify-center">
            {/* Background blob */}
            <div className="absolute inset-4 rounded-3xl bg-white shadow-md" />
            {/* Decorative teal blob behind */}
            <div className="absolute top-6 left-6 w-40 h-40 rounded-3xl bg-[#2DD4BF]/10" />

            {/* Robot SVG */}
            <svg width="160" height="180" viewBox="0 0 160 180" fill="none" className="relative z-10">
              {/* Antenna */}
              <line x1="80" y1="20" x2="80" y2="48" stroke="#1B2A4A" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="80" cy="14" r="8" fill="#EF4444"/>

              {/* Bookmark / flag top-right */}
              <rect x="108" y="32" width="22" height="28" rx="3" fill="#2DD4BF"/>
              <path d="M108 54 L119 46 L130 54" fill="#F5F6FA"/>

              {/* Body */}
              <rect x="38" y="48" width="84" height="80" rx="14" fill="#1B2A4A"/>

              {/* Eyes */}
              <circle cx="62" cy="84" r="10" fill="#2DD4BF"/>
              <circle cx="98" cy="84" r="10" fill="#2DD4BF"/>
              <circle cx="62" cy="84" r="5" fill="#0F766E"/>
              <circle cx="98" cy="84" r="5" fill="#0F766E"/>

              {/* Mouth / line */}
              <path d="M65 104 Q80 110 95 104" stroke="#2DD4BF" strokeWidth="3" strokeLinecap="round" fill="none"/>

              {/* Small connector left */}
              <rect x="22" y="70" width="16" height="26" rx="5" fill="#1B2A4A"/>
              {/* Small connector right */}
              <rect x="122" y="70" width="16" height="26" rx="5" fill="#1B2A4A"/>

              {/* Magnifying glass below */}
              <circle cx="66" cy="150" r="14" stroke="#CBD5E1" strokeWidth="3" fill="none"/>
              <line x1="76" y1="160" x2="86" y2="170" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1">
            <p className="text-[120px] font-black leading-none text-[var(--text-primary)]/10 select-none">
              404
            </p>
            <h1 className="text-4xl font-extrabold text-[var(--text-primary)] -mt-6 leading-tight">
              Oops! This page
              <br />
              <span className="text-[var(--accent)]">graduated</span>.
            </h1>
            <p className="text-gray-500 text-base mt-5 leading-relaxed max-w-sm">
              It looks like the page you're looking for isn't here anymore.
              It might have been moved, deleted, or simply never existed in our curriculum.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 mt-8 px-7 py-3.5 bg-[#0F766E] hover:bg-[#0D6B63] text-white font-semibold rounded-2xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Dashboard
            </Link>
          </div>

        </div>
      </main>
    </AppShell>
  );
}
