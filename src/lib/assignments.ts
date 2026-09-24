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
  /** YYYY-MM-DD. Absent for an Exam (isExam): it has no deadline and students never submit it. */
  dueDate?: string;
  maxPoints: number;
  categoryId?: string; // FK -> GradingCategory, which % of the course grade this assignment counts toward
  acceptsFiles: boolean;
  fileTypes: ("figma" | "pdf" | "image")[];
  submissionType: "individual" | "group";
  maxGroupSize: number | null;
  rubricIds: string[];
  /** Teacher clicked "Finish Grading" on the Grading page once every submission was processed
   *  (23/9/2569) — locks the assignment's cells in the Score Book to view-only (no more click-through
   *  to recheck). Absent/false = still open; reversible via "Reopen grading" so nobody gets stuck. */
  gradingFinalized?: boolean;
  /** Exam-type assignment (23/9/2569): scored with a manually-set max score, no rubric at all —
   *  `rubricIds` stays empty and `maxPoints` is user-entered instead of derived from a rubric's
   *  point total. Absent/false = the normal rubric-graded assignment. */
  isExam?: boolean;
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
  /** Legacy single-link field. New submissions keep the student's link here (if any)
   *  and put everything they handed in — files, images and the link — in `attachments`. */
  fileUrl: string | null;
  /** What the student submitted: up to 10 files/images plus an optional link. */
  attachments?: AssignmentAttachment[];
  aiScore: number | null;
  instructorScore: number | null;
  instructorComment: string;
  /** Per-criterion note, keyed by RubricCriterion.id — typically why the
   *  instructor moved a criterion's score away from the AI's suggestion. */
  criterionComments?: Record<string, string>;
  /** Per-criterion points earned, keyed by RubricCriterion.id — saved whenever the recheck
   *  page saves a score. Absent on submissions graded before this existed or given no rubric;
   *  callers that need a breakdown for those fall back to splitting the total by criterion weight
   *  (the same math the recheck page itself starts from — see RecheckPage's initial-scores effect). */
  criterionScores?: Record<string, number>;
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

/** Everything a submission holds, including ones saved before multi-file support. */
export function submissionAttachments(sub: Submission | undefined): AssignmentAttachment[] {
  if (!sub) return [];
  if (sub.attachments) return sub.attachments;
  // Old rows only ever had one link in fileUrl; a blob: URL from an old upload can't be reopened, so skip it.
  return sub.fileUrl && /^https?:\/\//i.test(sub.fileUrl)
    ? [{ id: `legacy-${sub.id}`, kind: "link", name: sub.fileUrl, source: "url", ref: sub.fileUrl }]
    : [];
}

/** What a STUDENT may see of a submission (25/9/2569). Scores are announced by the teacher's "Finish &
 *  announce" (gradingFinalized) — until then a graded submission reads as plain "submitted, awaiting
 *  grade": no score, no comment, no breakdown. Teacher-side code keeps using the raw submission. */
export function studentVisibleSubmission(assignment: Assignment | undefined, sub: Submission): Submission {
  if (sub.status !== "graded" || assignment?.gradingFinalized) return sub;
  return { ...sub, status: "not_graded", aiScore: null, instructorScore: null, instructorComment: "", criterionScores: undefined, criterionComments: undefined };
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
  updateSubmission: (id: string, data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "criterionComments" | "criterionScores" | "status" | "fileUrl" | "attachments">>) => void;
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
