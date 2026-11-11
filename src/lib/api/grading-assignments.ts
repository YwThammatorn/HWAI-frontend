import { client } from "./client";
import type { GradingAssignment } from "@/lib/grading-assignments";

// Backed by HWAI-backend (11/11/2569): which assignments a TA of a course is given to grade. Mirrors
// GradingAssignmentContextValue (src/lib/grading-assignments.ts). `taAccountId` = the TA's user id; one record per TA per course
// (a second one is a 409); `scope` is always { type: "assignments", assignmentIds }. The server removes records itself when a
// course, an assignment, a TA's section role or the account goes. `id` is optional on create — the Provider sends its own.

export async function getGradingAssignments(courseId?: string): Promise<GradingAssignment[]> {
  return client.get<GradingAssignment[]>(courseId ? `/api/courses/${courseId}/grading-assignments` : "/api/grading-assignments");
}

export async function addGradingAssignment(data: Omit<GradingAssignment, "id"> & { id?: string }): Promise<GradingAssignment> {
  return client.post<GradingAssignment>(`/api/courses/${data.courseId}/grading-assignments`, data);
}

export async function updateGradingAssignment(id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>): Promise<GradingAssignment> {
  return client.patch<GradingAssignment>(`/api/grading-assignments/${id}`, data);
}

export async function removeGradingAssignment(id: string): Promise<void> {
  return client.delete<void>(`/api/grading-assignments/${id}`);
}

export async function removeGradingAssignmentsByTa(taAccountId: string): Promise<void> {
  return client.delete<void>(`/api/grading-assignments?taAccountId=${encodeURIComponent(taAccountId)}`);
}

export async function removeGradingAssignmentsByTaInCourse(taAccountId: string, courseId: string): Promise<void> {
  return client.delete<void>(`/api/courses/${courseId}/grading-assignments?taAccountId=${encodeURIComponent(taAccountId)}`);
}
