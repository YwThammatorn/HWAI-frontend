"use client";

import { createContext, useContext } from "react";

/** Teacher-supplied reference material shown to students alongside the
 *  assignment brief (example work, a spec PDF, a Figma link, ...). This is NOT
 *  what students submit — see `Assignment.fileTypes` for that. */
export interface AssignmentAttachment {
  id: string;
  kind: "file" | "image" | "link";
  /** Display label: the file name, or the link's title (falls back to the URL). */
  name: string;
  /** "upload": `ref` is a storage key — resolve with resolveFileUrl() from
   *  @/lib/fileStorage. "url": `ref` is an external link used as-is. */
  source: "upload" | "url";
  ref: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  name: string;
  description: string;
  /** Optional reference files/images/links from the teacher. Absent on assignments created before this existed. */
  attachments?: AssignmentAttachment[];
  dueDate: string; // YYYY-MM-DD
  maxPoints: number;
  categoryId?: string; // FK -> GradingCategory, which % of the course grade this assignment counts toward
  acceptsFiles: boolean;
  fileTypes: ("figma" | "pdf" | "image")[];
  submissionType: "individual" | "group";
  maxGroupSize: number | null;
  rubricIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string; // denormalized for display; replace with join when API is ready
  email: string;       // denormalized for display
  submittedAt: string;
  fileUrl: string | null;
  aiScore: number | null;
  instructorScore: number | null;
  instructorComment: string;
  /** Per-criterion note, keyed by RubricCriterion.id — typically why the
   *  instructor moved a criterion's score away from the AI's suggestion. */
  criterionComments?: Record<string, string>;
  // Security: student work must not leave faculty without explicit consent
  externalUseConsent: boolean;
  status: "not_graded" | "need_review" | "graded";
  /** Set when this submission was created as part of a group assignment —
   *  every StudentGroup member gets their own row sharing this id, so a
   *  future "grade once, apply to the whole team" flow has something to
   *  group by without another data migration. */
  groupId?: string;
  updatedAt: string;
}

export interface CriterionLevel {
  label: string;
  description: string;
}

export const DEFAULT_LEVELS: CriterionLevel[] = [
  { label: "Excellent", description: "" },
  { label: "Good", description: "" },
  { label: "Needs Improvement", description: "" },
];

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight: number; // 0–100, sum of all criteria must equal 100
  levels: CriterionLevel[];
}

export interface Rubric {
  id: string;
  assignmentId: string;
  name: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentContextValue {
  assignments: Assignment[];
  submissions: Submission[];
  rubrics: Rubric[];
  addAssignment: (data: Omit<Assignment, "id" | "createdAt" | "updatedAt">) => Assignment;
  updateAssignment: (id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeAssignment: (id: string) => void;
  getAssignment: (id: string) => Assignment | undefined;
  getAssignmentsByCourse: (courseId: string) => Assignment[];
  addSubmission: (data: Omit<Submission, "id" | "updatedAt">) => Submission;
  updateSubmission: (id: string, data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "criterionComments" | "status" | "fileUrl">>) => void;
  getSubmissionsByAssignment: (assignmentId: string) => Submission[];
  addRubric: (data: Omit<Rubric, "id" | "createdAt" | "updatedAt">) => Rubric;
  updateRubric: (id: string, data: Partial<Omit<Rubric, "id" | "assignmentId" | "createdAt" | "updatedAt">>) => void;
  removeRubric: (id: string) => void;
  getRubric: (id: string) => Rubric | undefined;
  getRubricsByAssignment: (assignmentId: string) => Rubric[];
}

export const AssignmentContext = createContext<AssignmentContextValue | null>(null);

export function useAssignments(): AssignmentContextValue {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("useAssignments must be used within AssignmentProvider");
  return ctx;
}
