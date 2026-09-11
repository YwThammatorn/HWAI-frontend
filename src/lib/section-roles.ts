"use client";

import { createContext, useContext } from "react";

export type SectionRoleType = "teacher" | "ta" | "co-teacher";

export interface SectionRolePermissions {
  canManageRoster: boolean;
  canEditSettings: boolean;
  canPublishScores: boolean;
}

/** Default permission sets by role — TA is deliberately restricted per the
 *  4/9/2569 meeting (decision #4): cannot manage roster or edit section
 *  settings; publishing scores depends on the section's publishMode.
 *  Teacher/co-teacher get full access — see docs/phase1-model-validation.md
 *  S6 for why co-teacher must NOT inherit the TA defaults. */
export function defaultPermissionsFor(role: SectionRoleType): SectionRolePermissions {
  if (role === "ta") {
    return { canManageRoster: false, canEditSettings: false, canPublishScores: false };
  }
  return { canManageRoster: true, canEditSettings: true, canPublishScores: true };
}

export interface SectionRole {
  id: string;
  accountId: string; // FK → CohortStudent.id or ManagedTeacher.id (whichever the person is)
  courseId: string;  // FK → Course.id (section-shaped, see lib/courses.ts)
  role: SectionRoleType;
  permissions?: SectionRolePermissions; // overrides defaultPermissionsFor(role) when present
}

export interface SectionRoleContextValue {
  sectionRoles: SectionRole[];
  addSectionRole: (data: Omit<SectionRole, "id" | "permissions">) => SectionRole;
  removeSectionRole: (id: string) => void;
  removeRolesByAccount: (accountId: string) => void;
  getRolesBySection: (courseId: string) => SectionRole[];
  getRolesByAccount: (accountId: string) => SectionRole[];
  hasPermission: (accountId: string, courseId: string, permission: keyof SectionRolePermissions) => boolean;
}

export const SectionRoleContext = createContext<SectionRoleContextValue | null>(null);

export function useSectionRoles(): SectionRoleContextValue {
  const ctx = useContext(SectionRoleContext);
  if (!ctx) throw new Error("useSectionRoles must be used inside <SectionRoleProvider>");
  return ctx;
}
