import { client } from "./client";
import { withNulls } from "./sync";
import type { Assignment, Rubric, Submission } from "@/lib/assignments";

// Backed by HWAI-backend. Assignments, their rubrics and submissions. `id` is optional on create —
// AssignmentProvider sends a client-generated one so its optimistic state and the server agree.

type SubmissionChanges = Partial<Pick<Submission,
  "aiScore" | "instructorScore" | "instructorComment" | "criterionComments" | "criterionScores" | "status" | "fileUrl" | "attachments">>;

// ── Assignments ──────────────────────────────────────────────────────────────

/** One course's assignments, or every course's when `courseId` is omitted. */
export async function getAssignments(courseId?: string): Promise<Assignment[]> {
  return client.get<Assignment[]>(courseId ? `/api/courses/${courseId}/assignments` : "/api/assignments");
}

export async function createAssignment(data: Omit<Assignment, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Assignment> {
  return client.post<Assignment>(`/api/courses/${data.courseId}/assignments`, data);
}

export async function updateAssignment(id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt" | "updatedAt">>): Promise<Assignment> {
  return client.patch<Assignment>(`/api/assignments/${id}`, withNulls(data));
}

// Server cascades: the assignment's rubrics, submissions and student groups.
export async function deleteAssignment(id: string): Promise<void> {
  return client.delete<void>(`/api/assignments/${id}`);
}

// ── Submissions ──────────────────────────────────────────────────────────────

/** One assignment's submissions, or every submission when `assignmentId` is omitted. */
export async function getSubmissions(assignmentId?: string): Promise<Submission[]> {
  return client.get<Submission[]>(assignmentId ? `/api/assignments/${assignmentId}/submissions` : "/api/submissions");
}

/** One per student per assignment — resubmitting is updateSubmission (a second one is a 409). */
export async function addSubmission(data: Omit<Submission, "id" | "updatedAt"> & { id?: string }): Promise<Submission> {
  return client.post<Submission>(`/api/assignments/${data.assignmentId}/submissions`, data);
}

export async function updateSubmission(id: string, data: SubmissionChanges): Promise<Submission> {
  return client.patch<Submission>(`/api/submissions/${id}`, withNulls(data));
}

// ── Rubrics ──────────────────────────────────────────────────────────────────

/** One assignment's rubrics, or every rubric when `assignmentId` is omitted. */
export async function getRubrics(assignmentId?: string): Promise<Rubric[]> {
  return client.get<Rubric[]>(assignmentId ? `/api/assignments/${assignmentId}/rubrics` : "/api/rubrics");
}

export async function createRubric(data: Omit<Rubric, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Rubric> {
  return client.post<Rubric>(`/api/assignments/${data.assignmentId}/rubrics`, data);
}

export async function updateRubric(id: string, data: Partial<Omit<Rubric, "id" | "assignmentId" | "createdAt" | "updatedAt">>): Promise<Rubric> {
  return client.patch<Rubric>(`/api/rubrics/${id}`, data);
}

export async function deleteRubric(id: string): Promise<void> {
  return client.delete<void>(`/api/rubrics/${id}`);
}
