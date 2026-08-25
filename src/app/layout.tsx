import type { Metadata } from "next";
import CourseProvider from "@/components/CourseProvider";
import StudentProvider from "@/components/StudentProvider";
import CLOProvider from "@/components/CLOProvider";
import AssignmentProvider from "@/components/AssignmentProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import CohortStudentProvider from "@/context/CohortStudentContext";
import ManagedTeacherProvider from "@/context/ManagedTeacherContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "HWAI Agent",
  description: "AI-assisted grading system for UX/UI courses at KMITL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&family=Prompt:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LanguageProvider>
          <AuthProvider>
            <CohortStudentProvider>
              <ManagedTeacherProvider>
                <CourseProvider>
                  <StudentProvider>
                    <CLOProvider>
                      <AssignmentProvider>{children}</AssignmentProvider>
                    </CLOProvider>
                  </StudentProvider>
                </CourseProvider>
              </ManagedTeacherProvider>
            </CohortStudentProvider>
          </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
