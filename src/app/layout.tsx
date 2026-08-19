import type { Metadata } from "next";
import CourseProvider from "@/components/CourseProvider";
import StudentProvider from "@/components/StudentProvider";
import AssignmentProvider from "@/components/AssignmentProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HWAI Agent",
  description: "AI-assisted grading system for UX/UI courses at KMITL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full flex flex-col">
        <CourseProvider>
          <StudentProvider>
            <AssignmentProvider>{children}</AssignmentProvider>
          </StudentProvider>
        </CourseProvider>
      </body>
    </html>
  );
}
