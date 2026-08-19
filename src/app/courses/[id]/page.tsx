"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const course = getCourse(id);
  const students = getStudentsByCourse(id);
  const assignments = getAssignmentsByCourse(id);

  const activeAssignments = assignments.filter((a) => {
    const subs = getSubmissionsByAssignment(a.id);
    return subs.length > 0 && subs.some((s) => s.status !== "graded");
  }).length;
  const allGraded =
    assignments.length > 0 &&
    assignments.every((a) => {
      const subs = getSubmissionsByAssignment(a.id);
      return subs.length > 0 && subs.every((s) => s.status === "graded");
    });

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          ไม่พบรายวิชานี้ —{" "}
          <Link href="/courses" className="text-[#0F766E] ml-1 hover:underline">กลับไปหน้าหลัก</Link>
        </main>
      </div>
    );
  }

  const sourceLabel: Record<string, string> = {
    manual: "Manually Added",
    google: "Google Classroom",
    teams: "Microsoft Teams",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <Navbar />
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/courses" className="hover:text-[#0F766E] transition-colors">All Courses</Link>
          <span>/</span>
          <span className="text-[#1B2A4A] font-medium">{course.name}</span>
        </div>

        {/* Course header banner */}
        <div className="relative h-36 rounded-2xl mb-6 overflow-hidden" style={{ background: course.coverColor }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{course.name}</h1>
              <p className="text-white/70 text-xs mt-0.5">{sourceLabel[course.source]}</p>
            </div>
          </div>
          <Link
            href={`/courses/${id}/settings`}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium rounded-lg transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.22 3.22l1.41 1.41M9.37 9.37l1.41 1.41M3.22 10.78l1.41-1.41M9.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Settings
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Students", value: `${students.length}` },
            { label: "Assignments", value: `${assignments.length}` },
            { label: "Grading Status", value: allGraded ? "All Graded" : `${activeAssignments} Active` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-[#1B2A4A]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100 px-6">
            <Link
              href={`/courses/${id}/assignments`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-[#0F766E] transition-colors"
            >
              Assignments
              {assignments.length > 0 && (
                <span className="ml-1.5 text-xs bg-[#EEF2FF] text-[#6366F1] px-1.5 py-0.5 rounded-full">
                  {assignments.length}
                </span>
              )}
            </Link>
            <Link
              href={`/courses/${id}/clo`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-[#0F766E] transition-colors"
            >
              CLO
            </Link>
            <button className="py-3 px-4 text-sm font-medium border-b-2 border-[#0F766E] text-[#0F766E]">
              Students
              {students.length > 0 && (
                <span className="ml-1.5 text-xs bg-[#E6FAF8] text-[#0F7B6C] px-1.5 py-0.5 rounded-full">
                  {students.length}
                </span>
              )}
            </button>
            <Link
              href={`/courses/${id}/collaborators`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-[#0F766E] transition-colors"
            >
              Collaborators
            </Link>
            <button className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-[#0F766E] transition-colors">
              Results
            </button>
          </div>

          {students.length === 0 ? (
            /* Empty state */
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">ยังไม่มีรายชื่อนักศึกษา</p>
              <p className="text-xs text-gray-400 mb-5">นำเข้ารายชื่อจากไฟล์ CSV เพื่อเริ่มต้น</p>
              <Link
                href={`/courses/${id}/students/import`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#1B2A4A] text-sm font-medium rounded-xl transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                Import Students
              </Link>
            </div>
          ) : (
            /* Student list */
            <div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <p className="text-sm text-gray-500">{students.length} นักศึกษา</p>
                <Link
                  href={`/courses/${id}/students/import`}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0F766E] hover:underline font-medium"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                  Import เพิ่มเติม
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-50">
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">#</th>
                      <th className="px-6 py-3 font-medium">รหัสนักศึกษา</th>
                      <th className="px-6 py-3 font-medium">ชื่อ</th>
                      <th className="px-6 py-3 font-medium">นามสกุล</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 text-gray-300 text-xs">{i + 1}</td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-500">{s.studentId}</td>
                        <td className="px-6 py-3 text-[#1B2A4A]">{s.firstName}</td>
                        <td className="px-6 py-3 text-[#1B2A4A]">{s.lastName}</td>
                        <td className="px-6 py-3 text-gray-400 text-xs">{s.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
