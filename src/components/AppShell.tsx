"use client";
import Navbar from "./Navbar";
import ProfileSidebar from "./ProfileSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <Navbar />
      <div className="flex flex-1">
        <ProfileSidebar />
        <div className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
