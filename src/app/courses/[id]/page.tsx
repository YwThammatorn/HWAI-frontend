"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useCourses } from "@/lib/courses";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getCourse } = useCourses();
  const course = getCourse(id);

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          ไม่พบรายวิชานี้ —{" "}
          <Link href="/courses" className="text-[#2DD4BF] ml-1 hover:underline">กลับไปหน้าหลัก</Link>
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
          <Link href="/courses" className="hover:text-[#2DD4BF] transition-colors">All Courses</Link>
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
            { label: "Students", value: `${course.studentCount}` },
            { label: "Assignments", value: `${course.assignmentCount}` },
            {
              label: "Grading Status",
              value: course.allGraded ? "All Graded" : `${course.activeAssignments} Active`,
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-[#1B2A4A]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Placeholder tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100 px-6">
            {["Assignments", "Students", "Results"].map((tab, i) => (
              <button key={tab} className={[
                "py-3 px-4 text-sm font-medium border-b-2 transition-colors",
                i === 0 ? "border-[#2DD4BF] text-[#2DD4BF]" : "border-transparent text-gray-400",
              ].join(" ")}>
                {tab}
              </button>
            ))}
          </div>
          <div className="p-12 flex flex-col items-center justify-center text-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-sm">หน้านี้กำลังสร้าง</p>
            <p className="text-xs mt-1">จะพร้อมใช้งานเร็วๆ นี้</p>
          </div>
        </div>
      </main>
    </div>
  );
}
