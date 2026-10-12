"use client";

import { createContext, useContext } from "react";
import type { RubricCriterion } from "./assignments";

/** A rubric the teacher saved for reuse (12/10/2569) — per subject (courseTemplateId), so next year's section of the same
 *  subject finds it. Criteria are stored as they are in a rubric, without any grading data. */
export interface RubricLibraryEntry {
  id: string;
  name: string;
  /** the subject it belongs to; absent = offered for every course */
  courseTemplateId?: string;
  criteria: RubricCriterion[];
  sourceAssignmentId?: string;
  createdAt: string;
}

export interface RubricLibraryContextValue {
  entries: RubricLibraryEntry[];
  addEntry: (data: Omit<RubricLibraryEntry, "id" | "createdAt">) => RubricLibraryEntry;
  renameEntry: (id: string, name: string) => void;
  removeEntry: (id: string) => void;
}

export const RubricLibraryContext = createContext<RubricLibraryContextValue | null>(null);

export function useRubricLibrary(): RubricLibraryContextValue {
  const ctx = useContext(RubricLibraryContext);
  if (!ctx) throw new Error("useRubricLibrary must be used within RubricLibraryProvider");
  return ctx;
}
