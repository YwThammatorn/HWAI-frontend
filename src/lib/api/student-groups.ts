import { client } from "./client";
import type { StudentGroup } from "@/lib/studentGroups";

// Backed by HWAI-backend. Teams for group assignments. `id` is optional on create —
// StudentGroupProvider sends a client-generated one.

/** One assignment's teams, or every team when `assignmentId` is omitted. */
export async function getStudentGroups(assignmentId?: string): Promise<StudentGroup[]> {
  return client.get<StudentGroup[]>(assignmentId ? `/api/assignments/${assignmentId}/groups` : "/api/student-groups");
}

/** The server rejects a team bigger than the assignment's maxGroupSize (400). */
export async function addStudentGroup(data: Omit<StudentGroup, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<StudentGroup> {
  return client.post<StudentGroup>(`/api/assignments/${data.assignmentId}/groups`, data);
}

export async function updateStudentGroup(id: string, data: Partial<Pick<StudentGroup, "name" | "memberStudentIds">>): Promise<StudentGroup> {
  return client.patch<StudentGroup>(`/api/student-groups/${id}`, data);
}

export async function removeStudentGroup(id: string): Promise<void> {
  return client.delete<void>(`/api/student-groups/${id}`);
}
