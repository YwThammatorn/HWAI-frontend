"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "./Navbar";
import ProfileSidebar from "./ProfileSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role === "admin") router.replace("/admin");
    else if (user.role === "student") router.replace("/student");
  }, [user, router]);

  if (!user || user.role === "admin" || user.role === "student") return null;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <ProfileSidebar />
        <div className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
