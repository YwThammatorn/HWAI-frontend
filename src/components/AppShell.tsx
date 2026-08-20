"use client";
import Navbar from "./Navbar";
import ProfileSidebar from "./ProfileSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
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
