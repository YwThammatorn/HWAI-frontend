import type { Metadata } from "next";
import CourseProvider from "@/components/CourseProvider";
import StudentProvider from "@/components/StudentProvider";
import CLOProvider from "@/components/CLOProvider";
import AssignmentProvider from "@/components/AssignmentProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "HWAI Agent",
  description: "AI-assisted grading system for UX/UI courses at KMITL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <CourseProvider>
              <StudentProvider>
                <CLOProvider>
                  <AssignmentProvider>{children}</AssignmentProvider>
                </CLOProvider>
              </StudentProvider>
            </CourseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
