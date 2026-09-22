import { client } from "./client";
import type { SectionRole } from "@/lib/section-roles";

const KEY = "hwai_section_roles_v1";

function read(): SectionRole[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SectionRole[]) : [];
  } catch {
    return [];
  }
}

function write(items: SectionRole[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// SectionRoleContextValue (src/lib/section-roles.ts) 1:1. This is also what the app calls
// "Collaborators" on a course — there is no separate Collaborator resource, a collaborator IS a
// SectionRole row (role: "co-teacher" | "ta") plus the matching entry in ManagedTeacher.courseIds
// (see api/managed-teachers.ts) — a real backend should keep those two in sync server-side on
// add/remove, the way the live Providers do it with two separate client-side calls today.
//
// `hasPermission` is a pure client-side check over already-fetched roles (defaultPermissionsFor() in
// lib/section-roles.ts), not an endpoint — no api equivalent needed.
export async function getSectionRoles(courseId?: string): Promise<SectionRole[]> {
  // return client.get<SectionRole[]>(courseId ? `/api/courses/${courseId}/roles` : "/api/section-roles");
  void client;
  const all = read();
  return courseId ? all.filter((r) => r.courseId === courseId) : all;
}

export async function addSectionRole(data: Omit<SectionRole, "id" | "permissions">): Promise<SectionRole> {
  // return client.post<SectionRole>(`/api/courses/${data.courseId}/roles`, data);
  const item: SectionRole = { ...data, id: crypto.randomUUID() };
  write([...read(), item]);
  return item;
}

export async function removeSectionRole(id: string): Promise<void> {
  // return client.delete<void>(`/api/section-roles/${id}`);
  write(read().filter((r) => r.id !== id));
}
