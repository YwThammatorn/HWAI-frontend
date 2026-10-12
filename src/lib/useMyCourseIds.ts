"use client";

import { useMemo } from "react";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useSectionRoles } from "@/lib/section-roles";
import { useCurrentAccountId } from "@/lib/current-account";

/** The courses this signed-in teacher / TA is on: the admin-assigned list plus per-section roles (same rule as the My Courses page).
 *  No matching account → an empty set, never "everything". */
export function useMyCourseIds(): Set<string> {
  const { teachers } = useManagedTeachers();
  const { getRolesByAccount } = useSectionRoles();
  const accountId = useCurrentAccountId();
  return useMemo(() => {
    const me = accountId ? teachers.find((x) => x.id === accountId) : undefined;
    const roleIds = accountId ? getRolesByAccount(accountId).map((r) => r.courseId) : [];
    return new Set([...(me?.courseIds ?? []), ...roleIds]);
  }, [teachers, getRolesByAccount, accountId]);
}
