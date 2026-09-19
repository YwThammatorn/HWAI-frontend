import type { UserRole } from "@/context/AuthContext";

/**
 * Accounts that hold more than one role and can switch between them after
 * signing in (one login, several hats).
 *
 * Mock directory — localStorage-only auth has no server to ask, so the list
 * lives here. When the backend arrives this becomes "the roles the API says
 * this user has"; the shape below (which roles, and which identity each role
 * acts as) is what the API would need to return.
 *
 * Each role acts as its own identity: teacher/admin use the account's own
 * email, the student role acts as an existing CohortStudent (`studentId`) so
 * it sees exactly that student's courses and grades.
 */
export interface MultiRoleAccount {
  /** The email the person signs in with. */
  email: string;
  name: string;
  /** Roles the account holds, in the order the switcher lists them. */
  roles: UserRole[];
  /** Role active right after sign-in. */
  defaultRole: UserRole;
  /** Student persona used when acting as "student". */
  studentId?: string;
}

export const MULTI_ROLE_ACCOUNTS: MultiRoleAccount[] = [
  {
    email: "somsak.c@kmitl.ac.th",
    name: "Somsak Charoensuk",
    roles: ["admin", "teacher", "student"],
    defaultRole: "teacher",
    studentId: "69070101",
  },
];

export function findMultiRoleAccount(email: string | undefined | null): MultiRoleAccount | undefined {
  if (!email) return undefined;
  const key = email.trim().toLowerCase();
  return MULTI_ROLE_ACCOUNTS.find((a) => a.email.toLowerCase() === key);
}

/** The email a role acts as (a student persona signs in as `<id>@kmitl.ac.th`). */
export function identityEmail(account: MultiRoleAccount, role: UserRole): string {
  return role === "student" && account.studentId ? `${account.studentId}@kmitl.ac.th` : account.email;
}
