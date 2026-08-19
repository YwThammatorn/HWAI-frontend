"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useCourses, PRESET_COLORS } from "@/lib/courses";

const CONFIRM_MSG = "à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸—à¸µà¹ˆà¸à¸£à¸­à¸à¸ˆà¸°à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸\nà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸­à¸­à¸à¸ˆà¸²à¸à¸«à¸™à¹‰à¸²à¸™à¸µà¹‰à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?";

export default function NewCoursePage() {
  const router = useRouter();
  const { addCourse } = useCourses();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(PRESET_COLORS[0]);

  const isDirty =
    name.trim() !== "" ||
    description.trim() !== "" ||
    coverColor !== PRESET_COLORS[0];

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function navAway(to: string) {
    if (isDirty && !window.confirm(CONFIRM_MSG)) return;
    router.push(to);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const course = addCourse({
      name: name.trim(),
      description: description.trim(),
      status: "active",
      source: "manual",
      coverColor,
      iconColor: coverColor,
    });
    router.push(`/courses/${course.id}`);
  }

  const isValid = name.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <Navbar />

      <main className="flex-1 w-full max-w-[860px] mx-auto px-8 py-8">
        {/* Back */}
        <button onClick={() => navAway("/courses")} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0F766E] mb-6 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to All Courses
        </button>

        <h1 className="text-2xl font-bold text-[#1B2A4A] mb-6">Add New Course</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">General Information</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">
                Course Name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. UX/UI Design Principles"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">Course Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the course..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30 focus:border-[#0F766E] resize-none transition-colors"
              />
            </div>
          </section>

          {/* Course Visuals */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Course Visuals</h2>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* Upload Icon */}
              <div>
                <label className="block text-sm font-medium text-[#1B2A4A] mb-2">Upload Icon Image</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#0F766E] hover:text-[#0F766E] cursor-pointer transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-xs">Click to upload</span>
                </div>
              </div>

              {/* Color Picker */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-medium text-[#1B2A4A] mb-2 self-start">Cover Color</label>
                <div className="w-16 h-16 rounded-xl mb-3 shadow" style={{ background: coverColor }} />
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCoverColor(c)}
                      className="w-7 h-7 rounded-lg border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: coverColor === c ? "#1B2A4A" : "transparent",
                        transform: coverColor === c ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Upload Cover */}
              <div>
                <label className="block text-sm font-medium text-[#1B2A4A] mb-2">Upload Cover Image</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#0F766E] hover:text-[#0F766E] cursor-pointer transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span className="text-xs">Click to upload</span>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-5">
              <p className="text-xs text-gray-400 mb-2">Preview</p>
              <div className="w-48 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="h-20 relative" style={{ background: coverColor }}>
                  <div className="absolute bottom-2 left-2 w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                </div>
                <div className="bg-white p-3">
                  <p className="text-xs font-bold text-[#1B2A4A] truncate">{name || "Course Name"}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Manually Added</p>
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway("/courses")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] disabled:opacity-40 disabled:cursor-not-allowed text-[#1B2A4A] text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Create Course
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
