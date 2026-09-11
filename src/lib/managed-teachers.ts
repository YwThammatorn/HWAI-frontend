"use client";

import { createContext, useContext } from "react";

export interface ManagedTeacher {
  id: string;
  /** Academic rank (ผศ./รศ.ดร./ดร./Prof./etc.), separate from `name` — 10/9/2569.
   *  Optional since TAs and many teachers don't carry one. */
  title?: string;
  name: string;
  email: string;
  role: "teacher" | "ta";
  /** Account-level status — same active/inactive concept as CohortStudent.status
   *  (meeting decision 4/9/2569 #1). Was "active"|"suspended"; renamed 9/9/2569
   *  so the teacher and student status models use one shared vocabulary. The
   *  mechanic itself (reversible, confirm-dialog-gated) is unchanged. */
  status: "active" | "inactive";
  courseIds: string[]; // courses Admin assigned this teacher to
}

export interface ManagedTeacherContextValue {
  teachers: ManagedTeacher[];
  addTeacher: (data: Omit<ManagedTeacher, "id" | "courseIds" | "status">) => ManagedTeacher;
  importTeachers: (data: Omit<ManagedTeacher, "id" | "courseIds" | "status">[]) => ManagedTeacher[];
  updateTeacher: (id: string, data: Partial<Omit<ManagedTeacher, "id">>) => void;
  removeTeacher: (id: string) => void;
  deactivateTeacher: (id: string) => void;
  activateTeacher: (id: string) => void;
  getTeacher: (id: string) => ManagedTeacher | undefined;
  assignToCourse: (teacherId: string, courseId: string) => void;
  unassignFromCourse: (teacherId: string, courseId: string) => void;
  getTeachersByCourse: (courseId: string) => ManagedTeacher[];
}

// Longest/most-specific prefix first (e.g. "รศ.ดร." before "รศ." or "ดร."
// alone) so a compound title isn't split into the wrong two pieces.
const TITLE_PREFIXES = [
  "ศ.ดร.", "รศ.ดร.", "ผศ.ดร.",
  "ศ.", "รศ.", "ผศ.", "ดร.", "อ.",
  "Assoc. Prof.", "Asst. Prof.", "Prof.", "Dr.",
];

/** Splits a legacy title-prefixed name ("ผศ.สมศักดิ์ เจริญสุข") into
 *  { title: "ผศ.", name: "สมศักดิ์ เจริญสุข" } — used to migrate old
 *  localStorage data and old-format CSVs (title,name combined) onto the
 *  new separate `title` field. Names with no recognized prefix pass through
 *  unchanged (no `title`). */
export function splitTeacherTitle(fullName: string): { title?: string; name: string } {
  const trimmed = fullName.trim();
  for (const prefix of TITLE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return { title: prefix, name: trimmed.slice(prefix.length).trim() };
    }
  }
  return { name: trimmed };
}

export const ManagedTeacherContext = createContext<ManagedTeacherContextValue | null>(null);

export function useManagedTeachers(): ManagedTeacherContextValue {
  const ctx = useContext(ManagedTeacherContext);
  if (!ctx) throw new Error("useManagedTeachers must be used inside <ManagedTeacherProvider>");
  return ctx;
}
