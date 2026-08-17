import Link from "next/link";
import Navbar from "@/components/Navbar";
import type { Course } from "@/types/course";

// Placeholder data — will be replaced with API calls
const MOCK_COURSES: Course[] = [
  {
    id: "c1",
    code: "CE220",
    name: "UX/UI Design",
    semester: 1,
    year: 2567,
    section: "01",
    studentCount: 34,
    assignmentCount: 3,
    status: "active",
    createdAt: "2024-06-01",
  },
  {
    id: "c2",
    code: "CE320",
    name: "Interaction Design",
    semester: 1,
    year: 2567,
    section: "01",
    studentCount: 28,
    assignmentCount: 2,
    status: "active",
    createdAt: "2024-06-01",
  },
];

const USE_MOCK = false; // flip to true to preview list state

export default function CoursesPage() {
  const courses = USE_MOCK ? MOCK_COURSES : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <Navbar />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-8 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2137]">All Courses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your classes, assignments, and student progress from here.
            </p>
          </div>
          <Link
            href="/courses/new"
            className="flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-white font-medium rounded-lg text-sm transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add Course
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState />
        ) : (
          <CourseGrid courses={courses} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Illustration */}
      <div className="w-24 h-24 mb-6 rounded-2xl bg-[#E0F7F4] flex items-center justify-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="4" stroke="#2DD4BF" strokeWidth="2.5" />
          <path d="M16 18h16M16 24h10" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M34 34l6 6"
            stroke="#2DD4BF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="34" cy="30" r="5" stroke="#2DD4BF" strokeWidth="2.5" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[#0F2137] mb-2">
        Let&apos;s start your first class
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mb-8">
        Create a course to manage your assignments and start grading student submissions with AI assistance.
      </p>

      <Link
        href="/courses/new"
        className="flex items-center gap-2 px-6 py-2.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-white font-medium rounded-lg text-sm transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Add Your First Course
      </Link>
    </div>
  );
}

function CourseGrid({ courses }: { courses: Course[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const statusColor: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    archived: "bg-gray-100 text-gray-500",
    draft: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-mono text-gray-400">{course.code}</span>
          <h3 className="mt-0.5 font-semibold text-[#0F2137] leading-snug">
            {course.name}
          </h3>
        </div>
        <span
          className={[
            "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
            statusColor[course.status],
          ].join(" ")}
        >
          {course.status}
        </span>
      </div>

      {/* Meta */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>
          ภาคเรียนที่ {course.semester}/{course.year} • Sec {course.section}
        </div>
        <div className="flex gap-4">
          <span>{course.studentCount} students</span>
          <span>{course.assignmentCount} assignments</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
        <Link
          href={`/courses/${course.id}`}
          className="flex-1 text-center text-xs font-medium py-1.5 rounded-md bg-[#F7F9FC] hover:bg-[#E0F7F4] text-[#0F2137] hover:text-[#2DD4BF] transition-colors"
        >
          View
        </Link>
        <Link
          href={`/courses/${course.id}/settings`}
          className="flex-1 text-center text-xs font-medium py-1.5 rounded-md bg-[#F7F9FC] hover:bg-gray-100 text-gray-500 transition-colors"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
