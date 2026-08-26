import type { Metadata } from "next";
import { Lexend, Prompt } from "next/font/google";
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

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-lexend",
  display: "swap",
});

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HWAI Agent",
  description: "AI-assisted grading system for UX/UI courses at KMITL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full" suppressHydrationWarning>
      <head />
      <body className={`min-h-full flex flex-col ${lexend.variable} ${prompt.variable}`}>
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
