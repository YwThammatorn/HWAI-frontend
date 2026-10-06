import { client } from "./client";
import type { CLO } from "@/lib/clo";

// Backed by HWAI-backend. `id` is optional on create — CLOProvider sends a client-generated one.

/** One course's CLOs, or every course's when `courseId` is omitted. */
export async function getCLOs(courseId?: string): Promise<CLO[]> {
  return client.get<CLO[]>(courseId ? `/api/courses/${courseId}/clos` : "/api/clos");
}

export async function addCLO(data: Omit<CLO, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<CLO> {
  return client.post<CLO>(`/api/courses/${data.courseId}/clos`, data);
}

export async function updateCLO(id: string, data: Partial<Omit<CLO, "id" | "courseId" | "createdAt" | "updatedAt">>): Promise<CLO> {
  return client.patch<CLO>(`/api/clos/${id}`, data);
}

export async function removeCLO(id: string): Promise<void> {
  return client.delete<void>(`/api/clos/${id}`);
}
