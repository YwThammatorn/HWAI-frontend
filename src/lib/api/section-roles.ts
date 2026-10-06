import { client } from "./client";
import type { SectionRole } from "@/lib/section-roles";

// Backed by HWAI-backend. There is no separate "Collaborator" resource — a collaborator on a course
// *is* a SectionRole: a TA is a student (accountId = CohortStudent.id), a co-teacher is a teacher
// (accountId = ManagedTeacher.id). The server rejects a role that doesn't fit the account (400) and a
// second role for the same person in a course (409). `id` is optional on create — SectionRoleProvider
// sends a client-generated one. hasPermission() stays a client-side check over the loaded roles.

/** One course's roles, or every role when `courseId` is omitted (what SectionRoleProvider loads). */
export async function getSectionRoles(courseId?: string): Promise<SectionRole[]> {
  return client.get<SectionRole[]>(courseId ? `/api/courses/${courseId}/roles` : "/api/section-roles");
}

export async function addSectionRole(data: Omit<SectionRole, "id" | "permissions"> & { id?: string }): Promise<SectionRole> {
  return client.post<SectionRole>(`/api/courses/${data.courseId}/roles`, data);
}

export async function removeSectionRole(id: string): Promise<void> {
  return client.delete<void>(`/api/section-roles/${id}`);
}

// No removeRolesByAccount endpoint: deleting a teacher or student removes their roles server-side.
