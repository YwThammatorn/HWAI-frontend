import { client } from "./client";
import type { RubricLibraryEntry } from "@/lib/rubricLibrary";
import type { CalibrationRun } from "@/lib/calibration";

// Backed by HWAI-backend: the rubric reuse library and AI calibration runs. `id` is optional on create —
// the providers send a client-generated one so their optimistic state and the server agree.

// ── Rubric library ───────────────────────────────────────────────────────────

/** Every entry, or (with `courseTemplateId`) that subject's entries plus the ones offered for every course. */
export async function getRubricLibrary(courseTemplateId?: string): Promise<RubricLibraryEntry[]> {
  return client.get<RubricLibraryEntry[]>(
    courseTemplateId ? `/api/rubric-library?courseTemplateId=${encodeURIComponent(courseTemplateId)}` : "/api/rubric-library",
  );
}

export async function addRubricLibraryEntry(data: Omit<RubricLibraryEntry, "id" | "createdAt"> & { id?: string }): Promise<RubricLibraryEntry> {
  return client.post<RubricLibraryEntry>("/api/rubric-library", data);
}

export async function renameRubricLibraryEntry(id: string, name: string): Promise<RubricLibraryEntry> {
  return client.patch<RubricLibraryEntry>(`/api/rubric-library/${id}`, { name });
}

export async function removeRubricLibraryEntry(id: string): Promise<void> {
  return client.delete<void>(`/api/rubric-library/${id}`);
}

// ── Calibration runs ─────────────────────────────────────────────────────────

/** Every run, or one assignment's. */
export async function getCalibrationRuns(assignmentId?: string): Promise<CalibrationRun[]> {
  return client.get<CalibrationRun[]>(
    assignmentId ? `/api/calibration-runs?assignmentId=${encodeURIComponent(assignmentId)}` : "/api/calibration-runs",
  );
}

/** Create or replace a whole run (CalibrationProvider.saveRun). */
export async function saveCalibrationRun(run: CalibrationRun): Promise<CalibrationRun> {
  return client.put<CalibrationRun>(`/api/calibration-runs/${run.id}`, run);
}

export async function removeCalibrationRun(id: string): Promise<void> {
  return client.delete<void>(`/api/calibration-runs/${id}`);
}
