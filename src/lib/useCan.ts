"use client";

import { useAuth } from "@/context/AuthContext";
import { defaultPermissionsFor } from "@/lib/section-roles";

/**
 * What the signed-in staff member may do on the teacher pages (10/11/2569). A teacher may do everything; a TA (a student appointed to assist a course,
 * or a teacher previewing as one) may give and change scores and look at the rest. The user's decision of 10/11/2569: a TA does not use the AI (grade
 * with AI, re-grade, calibrate), does not edit rubrics, assignments or the roster, does not announce or reopen grading, and does not export scores.
 *
 * Built on `defaultPermissionsFor` (lib/section-roles.ts: the 4/9/2569 meeting's "a TA cannot manage the roster or the section settings, and publishing
 * is the teacher's"); only what that table has no word for (the AI, export) is decided here.
 */
export interface Can {
  isTa: boolean;
  /** give and change scores (Grade, Save) */
  gradeScores: boolean;
  /** Grade with AI, Re-grade, regrade with the new rubric */
  useAi: boolean;
  /** Calibrate AI */
  calibrate: boolean;
  editRubric: boolean;
  /** create, edit and delete assignments */
  editAssignment: boolean;
  /** Announce results / Reopen grading */
  announce: boolean;
  /** CSV export of scores */
  exportScores: boolean;
  /** add, import, remove and withdraw students */
  manageRoster: boolean;
}

export function useCan(): Can {
  const { effectiveRole } = useAuth();
  const isTa = effectiveRole === "ta";
  const p = defaultPermissionsFor(isTa ? "ta" : "teacher");
  return {
    isTa,
    gradeScores: true,
    useAi: !isTa,
    calibrate: !isTa,
    editRubric: p.canEditSettings,
    editAssignment: p.canEditSettings,
    announce: p.canPublishScores,
    exportScores: !isTa,
    manageRoster: p.canManageRoster,
  };
}
