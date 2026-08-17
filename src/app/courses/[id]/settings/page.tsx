import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CourseSettingsPage({ params }: Props) {
  const { id } = await params;

  // Placeholder — will be replaced with real fetch
  const course = {
    id,
    code: "CE220",
    name: "UX/UI Design",
    semester: 1,
    year: 2567,
    section: "01",
    description: "",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <Navbar />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/courses" className="hover:text-[#2DD4BF] transition-colors">
            All Courses
          </Link>
          <span>/</span>
          <Link href={`/courses/${id}`} className="hover:text-[#2DD4BF] transition-colors">
            {course.name}
          </Link>
          <span>/</span>
          <span className="text-[#0F2137] font-medium">Settings</span>
        </div>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0F2137]">Course Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Edit course information and manage course configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* General info card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-[#0F2137] mb-5">General Information</h2>

              <div className="space-y-4">
                <FormField label="Course Name" required>
                  <input
                    type="text"
                    defaultValue={course.name}
                    placeholder="e.g. UX/UI Design"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition"
                  />
                </FormField>

                <FormField label="Course Code" required>
                  <input
                    type="text"
                    defaultValue={course.code}
                    placeholder="e.g. CE220"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition font-mono"
                  />
                </FormField>

                <FormField label="Description">
                  <textarea
                    defaultValue={course.description}
                    placeholder="Brief description of the course..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition resize-none"
                  />
                </FormField>
              </div>
            </div>

            {/* Semester info card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-[#0F2137] mb-5">Semester & Section</h2>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Semester" required>
                  <select
                    defaultValue={course.semester}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition bg-white"
                  >
                    <option value={1}>ภาคเรียนที่ 1</option>
                    <option value={2}>ภาคเรียนที่ 2</option>
                    <option value={3}>ภาคเรียนที่ 3 (ฤดูร้อน)</option>
                  </select>
                </FormField>

                <FormField label="Academic Year" required>
                  <input
                    type="number"
                    defaultValue={course.year}
                    placeholder="2567"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition"
                  />
                </FormField>

                <FormField label="Section" required>
                  <input
                    type="text"
                    defaultValue={course.section}
                    placeholder="01"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/40 focus:border-[#2DD4BF] transition"
                  />
                </FormField>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <Link
                href={`/courses/${id}`}
                className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium rounded-lg bg-[#2DD4BF] hover:bg-[#14B8A6] text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Danger zone */}
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-6">
              <h2 className="font-semibold text-red-600 mb-3">Danger Zone</h2>
              <p className="text-xs text-gray-500 mb-4">
                Archiving a course hides it from the main view. It can be restored later.
              </p>
              <button className="w-full text-sm font-medium py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                Archive Course
              </button>
            </div>

            {/* Info */}
            <div className="bg-[#F0FFFE] rounded-xl border border-[#B2F0EB] p-4 text-xs text-[#0F7B6C] space-y-1">
              <p className="font-medium">Student enrollment</p>
              <p className="text-[#0F7B6C]/70">
                Manage students from the Students tab inside the course view.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#0F2137]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
