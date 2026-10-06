import { ApiError, client } from "./client";
import { withNulls } from "./sync";
import type { Student } from "@/lib/students";

// Backed by HWAI-backend. A course's roster (per-section Student rows — not the account-level CohortStudent,
// see api/cohort-students.ts). `id` is optional on create — StudentProvider sends a client-generated one.

/** One course's roster, or every roster when `courseId` is omitted (what StudentProvider loads). */
export async function getStudents(courseId?: string): Promise<Student[]> {
  return client.get<Student[]>(courseId ? `/api/courses/${courseId}/students` : "/api/students");
}

export interface RejectedEnrollment {
  studentId: string;
  program: string;
  sectionProgram: string;
  reason: "wrong_program";
}

/** The server numbers new rows after the current roster and marks late additions "added-midterm",
 *  unless sequenceNumber / enrollmentStatus are given (StudentProvider always gives them).
 *
 *  One section = one program (see lib/sectionProgram.ts): the server enrols the matching students and
 *  refuses the rest (422 when nobody fits). The UI already blocks those, so a refusal means the local
 *  view was stale — this throws, which makes the write queue alert and reload rosters from the server. */
export async function addStudents(courseId: string, incoming: (Omit<Student, "courseId" | "id"> & { id?: string })[]): Promise<Student[]> {
  let result: { enrolled: Student[]; rejected: RejectedEnrollment[] };
  try {
    result = await client.post(`/api/courses/${courseId}/students`, incoming);
  } catch (err) {
    // 422 = nobody fitted; its body carries the same per-row list.
    if (err instanceof ApiError && err.status === 422) {
      const body = JSON.parse(err.message) as { rejected?: RejectedEnrollment[] };
      if (body.rejected?.length) throw wrongProgramError(body.rejected);
    }
    throw err;
  }
  if (result.rejected.length > 0) throw wrongProgramError(result.rejected);
  return result.enrolled;
}

function wrongProgramError(rejected: RejectedEnrollment[]) {
  const list = rejected.map((r) => `${r.studentId} (${r.program})`).join(", ");
  const program = rejected[0].sectionProgram;
  return new Error(
    `ไม่ได้เพิ่มนักศึกษาต่างหลักสูตรเข้า section ${program}: ${list}\n` +
      `Not enrolled — another program than this ${program} section: ${list}`,
  );
}

export async function updateStudent(id: string, data: Partial<Omit<Student, "id" | "courseId">>): Promise<Student> {
  return client.patch<Student>(`/api/students/${id}`, withNulls(data));
}

export async function removeStudent(id: string): Promise<void> {
  return client.delete<void>(`/api/students/${id}`);
}
