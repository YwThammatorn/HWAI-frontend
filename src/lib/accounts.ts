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
    email: "kiatnarong.to@kmitl.ac.th",
    // Teacher names are always Thai regardless of the language toggle (30/9/2569) — this is the
    // same person as teachers-mockup.json's t-mock-1, so the name must match exactly.
    name: "เกียรติณรงค์ ทองประเสริฐ",
    // Admin + teacher only (8/11/2569), as HWAI-backend gives it: one account is one email, and a
    // staff email can't also be a student (a student role needs that student's own id and email).
    roles: ["admin", "teacher"],
    defaultRole: "teacher",
  },
];

/** Which student the demo logins act as, when this machine has swapped the mock's 69070101 for someone else (15/10/2569). Set by console command [23]
 *  (a real class kept out of git); absent = the committed mock student. Read from localStorage so no real id ever sits in the source. */
export const DEMO_STUDENT_KEY = "hwai_demo_student";
export function demoStudent(): { studentId: string; name?: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(DEMO_STUDENT_KEY) ?? "null");
    return v && typeof v.studentId === "string" && v.studentId ? v : null;
  } catch { return null; }
}

export function findMultiRoleAccount(email: string | undefined | null): MultiRoleAccount | undefined {
  if (!email) return undefined;
  const key = email.trim().toLowerCase();
  const account = MULTI_ROLE_ACCOUNTS.find((a) => a.email.toLowerCase() === key);
  const swap = account?.studentId ? demoStudent() : null;
  return account && swap ? { ...account, studentId: swap.studentId } : account;
}

/** The email a role acts as (a student persona signs in as `<id>@kmitl.ac.th`). */
export function identityEmail(account: MultiRoleAccount, role: UserRole): string {
  return role === "student" && account.studentId ? `${account.studentId}@kmitl.ac.th` : account.email;
}
