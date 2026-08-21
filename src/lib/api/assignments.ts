import { client } from "./client";
import type { Assignment, Submission, Rubric } from "@/lib/assignments";

const KEYS = {
  assignments: "hwai_assignments_v1",
  submissions: "hwai_submissions_v1",
  rubrics: "hwai_rubrics_v1",
};

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready
export async function getAssignments(courseId?: string): Promise<Assignment[]> {
  // return client.get<Assignment[]>(`/api/courses/${courseId}/assignments`);
  void client;
  const all = read<Assignment>(KEYS.assignments);
  return courseId ? all.filter((a) => a.courseId === courseId) : all;
}

export async function createAssignment(data: Omit<Assignment, "id" | "createdAt" | "updatedAt">): Promise<Assignment> {
  // return client.post<Assignment>(`/api/courses/${data.courseId}/assignments`, data);
  const now = new Date().toISOString();
  const item: Assignment = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write(KEYS.assignments, [...read<Assignment>(KEYS.assignments), item]);
  return item;
}

export async function updateAssignment(id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt">>): Promise<Assignment> {
  // return client.patch<Assignment>(`/api/assignments/${id}`, data);
  const items = read<Assignment>(KEYS.assignments).map((a) =>
    a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a,
  );
  write(KEYS.assignments, items);
  const updated = items.find((a) => a.id === id);
  if (!updated) throw new Error(`Assignment ${id} not found`);
  return updated;
}

export async function deleteAssignment(id: string): Promise<void> {
  // return client.delete<void>(`/api/assignments/${id}`);
  write(KEYS.assignments, read<Assignment>(KEYS.assignments).filter((a) => a.id !== id));
}

export async function getSubmissions(assignmentId: string): Promise<Submission[]> {
  // return client.get<Submission[]>(`/api/assignments/${assignmentId}/submissions`);
  return read<Submission>(KEYS.submissions).filter((s) => s.assignmentId === assignmentId);
}

export async function updateSubmission(id: string, data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "status" | "fileUrl">>): Promise<Submission> {
  // return client.patch<Submission>(`/api/submissions/${id}`, data);
  const items = read<Submission>(KEYS.submissions).map((s) =>
    s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s,
  );
  write(KEYS.submissions, items);
  const updated = items.find((s) => s.id === id);
  if (!updated) throw new Error(`Submission ${id} not found`);
  return updated;
}

export async function getRubrics(assignmentId: string): Promise<Rubric[]> {
  // return client.get<Rubric[]>(`/api/assignments/${assignmentId}/rubrics`);
  return read<Rubric>(KEYS.rubrics).filter((r) => r.assignmentId === assignmentId);
}

export async function createRubric(data: Omit<Rubric, "id" | "createdAt" | "updatedAt">): Promise<Rubric> {
  // return client.post<Rubric>(`/api/assignments/${data.assignmentId}/rubrics`, data);
  const now = new Date().toISOString();
  const item: Rubric = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write(KEYS.rubrics, [...read<Rubric>(KEYS.rubrics), item]);
  return item;
}

export async function updateRubric(id: string, data: Partial<Omit<Rubric, "id" | "assignmentId" | "createdAt">>): Promise<Rubric> {
  // return client.patch<Rubric>(`/api/rubrics/${id}`, data);
  const items = read<Rubric>(KEYS.rubrics).map((r) =>
    r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r,
  );
  write(KEYS.rubrics, items);
  const updated = items.find((r) => r.id === id);
  if (!updated) throw new Error(`Rubric ${id} not found`);
  return updated;
}

export async function deleteRubric(id: string): Promise<void> {
  // return client.delete<void>(`/api/rubrics/${id}`);
  write(KEYS.rubrics, read<Rubric>(KEYS.rubrics).filter((r) => r.id !== id));
}
