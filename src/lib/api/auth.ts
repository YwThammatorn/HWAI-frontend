import { client } from "./client";
import type { AuthUser, UserRole } from "@/context/AuthContext";

export type { AuthUser };

/**
 * Sign-in through HWAI-backend. The session is an HttpOnly cookie set by the API — the page never
 * reads or stores a token; it only asks the API who is signed in (me()).
 *
 * Real sign-in is Google (accounts @kmitl.ac.th, no self-registration): the login page's Google button
 * gives an ID token, googleLogin() hands it to the backend, which verifies it. Demo sign-in lets a short
 * allow-list of existing accounts in without Google while the backend runs with DEMO_LOGIN=true (never
 * in production) — it skips Google only; the account keeps exactly its own permissions.
 */

export interface AuthConfig {
  /** Demo sign-in is on (the login page shows the demo buttons and the banner). */
  demoLogin: boolean;
  demoAccounts: string[];
  /** Google sign-in is configured. */
  google: boolean;
  /** The OAuth client for the "Sign in with Google" button (present when `google`). */
  googleClientId?: string;
  /** The only Workspace domain the backend accepts (kmitl.ac.th). */
  googleDomain?: string;
}

/** GET /api/auth/me — who the session cookie belongs to, and every role they hold. */
export interface Me {
  email: string;
  name: string;
  /** Signed in through demo sign-in. */
  demo: boolean;
  roles: UserRole[];
  defaultRole: UserRole;
  teacher: { id: string; role: "teacher" | "ta"; name: string } | null;
  /** The student this account is (null for staff — a teacher is never also a student). */
  student: { id: string; studentId: string; name: string; email: string } | null;
}

export function authConfig(): Promise<AuthConfig> {
  return client.get<AuthConfig>("/api/auth/config");
}

/** Google's ID token from the "Sign in with Google" button — the backend verifies it and starts the session. */
export function googleLogin(credential: string): Promise<Me> {
  return client.post<Me>("/api/auth/google", { credential });
}

export function demoLogin(email: string): Promise<Me> {
  return client.post<Me>("/api/auth/demo-login", { email });
}

export function logout(): Promise<void> {
  return client.post<void>("/api/auth/logout", {});
}

export function me(): Promise<Me> {
  return client.get<Me>("/api/auth/me");
}

/** The UI's session for `me`, acting as `role` (falls back to their default role). */
export function userFromMe(me: Me, role?: UserRole): AuthUser {
  const active = role && me.roles.includes(role) ? role : me.defaultRole;
  const asStudent = active === "student" && me.student;
  return {
    name: asStudent ? me.student!.name : me.name,
    email: asStudent ? me.student!.email : me.email,
    role: active,
    ...(asStudent && { studentId: me.student!.studentId }),
    ...(me.roles.length > 1 && { roles: me.roles }),
    accountEmail: me.email,
    ...(me.demo && { demo: true }),
  };
}
