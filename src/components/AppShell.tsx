"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "./Navbar";
import ProfileSidebar from "./ProfileSidebar";

// Preview-as-TA is scoped to grading-related pages only (meeting 26/8/2569,
// [[project-hwai-meeting-20260826]]). Course list/overview/assignment-list are
// included too — without them there's no way to navigate to a specific
// assignment's grading page at all.
const TA_PREVIEW_ALLOWED: RegExp[] = [
  /^\/teacher\/courses$/,
  /^\/teacher\/courses\/[^/]+$/,
  /^\/teacher\/courses\/[^/]+\/assignments$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+\/grading$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+\/results$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+\/recheck$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+\/rubrics\/[^/]+$/,
];
// Checked before TA_PREVIEW_ALLOWED — "new"/"[assignmentId]/edit" would
// otherwise false-match the generic [^/]+ id-segment patterns above.
const TA_PREVIEW_BLOCKED: RegExp[] = [
  /^\/teacher\/courses\/new$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/new$/,
  /^\/teacher\/courses\/[^/]+\/assignments\/[^/]+\/edit$/,
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole, viewAs } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (effectiveRole === "admin") router.replace("/admin");
    else if (effectiveRole === "student") router.replace("/student");
  }, [user, effectiveRole, router]);

  useEffect(() => {
    if (viewAs !== "ta") return;
    const blocked = TA_PREVIEW_BLOCKED.some((re) => re.test(pathname));
    const allowed = !blocked && TA_PREVIEW_ALLOWED.some((re) => re.test(pathname));
    if (!allowed) router.replace("/teacher/courses");
  }, [viewAs, pathname, router]);

  if (!user || !effectiveRole || effectiveRole === "admin" || effectiveRole === "student") return null;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <ProfileSidebar />
        <div className="flex-1 min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </div>
      </div>
    </div>
  );
}
