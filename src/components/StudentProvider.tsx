"use client";

import { useState, useCallback, useEffect } from "react";
import { StudentContext, Student } from "@/lib/students";

const LS_KEY = "hwai_students_v1";

export default function StudentProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setStudents(JSON.parse(raw) as Student[]);
    } catch {}
  }, []);

  const persist = useCallback((next: Student[]) => {
    setStudents(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const addStudents = useCallback(
    (courseId: string, incoming: Omit<Student, "id" | "courseId">[]) => {
      // Append to the existing roster for this section — do not replace it.
      // sequenceNumber continues from the current roster size (มติที่ประชุม
      // 4/9/2569: คนใหม่ที่เพิ่มกลางเทอมได้เลขต่อท้าย ไม่ renumber ของเดิม).
      const existingInCourse = students.filter((s) => s.courseId === courseId);
      let nextSeq = existingInCourse.length + 1;
      const next: Student[] = incoming.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        courseId,
        sequenceNumber: s.sequenceNumber ?? nextSeq++,
        enrollmentStatus: s.enrollmentStatus ?? (existingInCourse.length > 0 ? "added-midterm" : "enrolled"),
      }));
      persist([...students, ...next]);
    },
    [students, persist]
  );

  const updateStudent = useCallback(
    (id: string, data: Partial<Omit<Student, "id" | "courseId">>) =>
      persist(students.map((s) => (s.id === id ? { ...s, ...data } : s))),
    [students, persist]
  );

  const removeStudent = useCallback(
    (id: string) => persist(students.filter((s) => s.id !== id)),
    [students, persist]
  );

  const getStudentsByCourse = useCallback(
    (courseId: string) => students.filter((s) => s.courseId === courseId),
    [students]
  );

  return (
    <StudentContext.Provider value={{ students, addStudents, updateStudent, removeStudent, getStudentsByCourse }}>
      {children}
    </StudentContext.Provider>
  );
}
