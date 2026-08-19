"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";

const CONFIRM_MSG = "การเปลี่ยนแปลงจะไม่ถูกบันทึก\nต้องการออกจากหน้านี้หรือไม่?";

export default function EditAssignmentPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const { getCourse } = useCourses();
  const { getAssignment, updateAssignment, removeAssignment } = useAssignments();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxPoints, setMaxPoints] = useState("100");
  const [saved, setSaved] = useState(false);
  const origRef = useRef({ name: "", description: "", dueDate: "", maxPoints: "" });

  useEffect(() => {
    if (assignment) {
      const orig = {
        name: assignment.name,
        description: assignment.description,
        dueDate: assignment.dueDate,
        maxPoints: String(assignment.maxPoints),
      };
      setName(orig.name);
      setDescription(orig.description);
      setDueDate(orig.dueDate);
      setMaxPoints(orig.maxPoints);
      origRef.current = orig;
    }
  }, [assignment?.id]);

  const todayStr = new Date().toISOString().split("T")[0];
  const minDate =
    origRef.current.dueDate && origRef.current.dueDate < todayStr
      ? origRef.current.dueDate
      : todayStr;

  const isDirty =
    !saved && (
      name !== origRef.current.name ||
      description !== origRef.current.description ||
      dueDate !== origRef.current.dueDate ||
      maxPoints !== origRef.current.maxPoints
    );

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateAssignment(assignmentId, {
      name: name.trim(),
      description: description.trim(),
      dueDate,
      maxPoints: parseInt(maxPoints) || 100,
    });
    setSaved(true);
    setTimeout(() => router.push(`/courses/${id}/assignments/${assignmentId}`), 800);
  }

  function handleDelete() {
    if (!window.confirm(`ลบ "${assignment?.name}" ถาวร? ไม่สามารถกู้คืนได้`)) return;
    removeAssignment(assignmentId);
    router.push(`/courses/${id}/assignments`);
  }

  if (!course || !assignment) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          ไม่พบข้อมูล —{" "}
          <Link href={`/courses/${id}/assignments`} className="text-[#2DD4BF] ml-1 hover:underline">กลับไปรายการชิ้นงาน</Link>
        </main>
      </div>
    );
  }

  const isValid = name.trim().length > 0 && dueDate !== "";

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <Navbar />
      <main className="flex-1 w-full max-w-[700px] mx-auto px-8 py-10">

        <button
          onClick={() => navAway(`/courses/${id}/assignments/${assignmentId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#2DD4BF] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Course
        </button>

        <h1 className="text-2xl font-bold text-[#1B2A4A] mb-1">Edit Existing Assignment</h1>
        <p className="text-sm text-gray-400 mb-8">
          You are editing assignment{" "}
          <span className="font-semibold text-[#1B2A4A]">{assignment.name}</span>{" "}
          within manually added course{" "}
          <span className="font-semibold text-[#1B2A4A]">{course.name}</span>
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          {/* General Information */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <h2 className="text-sm font-semibold text-[#1B2A4A]">General Information</h2>
            </div>
            <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">
              Assignment Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 focus:border-[#2DD4BF] transition-colors"
              required
            />
          </section>

          {/* Description */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
              </svg>
              <h2 className="text-sm font-semibold text-[#1B2A4A]">Assignment Description</h2>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 focus:border-[#2DD4BF] resize-none transition-colors"
            />
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/>
              </svg>
              <h2 className="text-sm font-semibold text-[#1B2A4A]">Assignment Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">
                  Due Date <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input
                    type="date"
                    value={dueDate}
                    min={minDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 focus:border-[#2DD4BF] transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1B2A4A] mb-1.5">Points Possible</label>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {[10, 15, 25, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setMaxPoints(String(p))}
                      className={[
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        maxPoints === String(p)
                          ? "bg-[#2DD4BF] text-white border-[#2DD4BF]"
                          : "border-gray-200 text-gray-500 hover:border-[#2DD4BF] hover:text-[#2DD4BF]",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxPoints}
                  onChange={(e) => setMaxPoints(e.target.value)}
                  placeholder="หรือพิมพ์เอง"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/30 focus:border-[#2DD4BF] transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-4">Danger Zone</h2>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete Assignment
            </button>
            <p className="text-xs text-gray-400 mt-3">การลบชิ้นงานจะลบข้อมูลการส่งและผลการตรวจทั้งหมด ไม่สามารถกู้คืนได้</p>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navAway(`/courses/${id}/assignments/${assignmentId}`)}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={[
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors",
                saved ? "bg-emerald-500" : "bg-[#2DD4BF] hover:bg-[#14B8A6] disabled:opacity-40 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {saved ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
              ) : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
