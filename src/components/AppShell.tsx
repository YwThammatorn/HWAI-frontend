"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "./Navbar";
import ProfileSidebar from "./ProfileSidebar";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { useSectionRoles } from "@/lib/section-roles";
import { taPathAllowed } from "@/lib/taPaths";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole, viewAs, wearHat } = useAuth();
  const myCourseIds = useMyCourseIds();
  const { ready } = useSectionRoles();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (effectiveRole === "admin") router.replace("/admin");
    else if (effectiveRole === "student") router.replace("/student");
  }, [user, effectiveRole, router]);

  // The TA hat (a real TA, or a teacher previewing as one): only the TA pages, and only of the courses it assists (lib/taPaths.ts)
  useEffect(() => {
    if (effectiveRole !== "ta") return;
    const verdict = taPathAllowed(pathname);
    if (!verdict.allowed) { router.replace("/teacher/courses"); return; }
    if (!ready) return;                                              // the stored roles are not read yet: do not judge the course
    if (verdict.courseId && !myCourseIds.has(verdict.courseId)) router.replace("/teacher/courses");
  }, [effectiveRole, pathname, router, ready, myCourseIds]);

  // A student whose TA appointments are gone (role removed, or now enrolled that term) is put back on the student hat
  useEffect(() => {
    if (!ready || user?.role !== "ta" || viewAs) return;
    if (myCourseIds.size === 0) { wearHat("student"); router.replace("/student"); }
  }, [ready, user?.role, viewAs, myCourseIds, wearHat, router]);

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
