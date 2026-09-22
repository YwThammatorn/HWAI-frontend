import { client } from "./client";
import type { AuthUser } from "@/context/AuthContext";

export type { AuthUser };

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: AuthUser["role"];
}

// Phase 1: localStorage mock — swap bodies to client.*() when backend is ready.
// AuthUser is imported from context/AuthContext.tsx (the real session shape) so this can't drift the
// way this file used to (it had its own narrower AuthUser — no "student"/"admin" role, no studentId/
// roles/accountEmail — caught 22/9 while extending this layer to every domain).
export async function login(payload: LoginPayload): Promise<AuthUser> {
  // return client.post<AuthUser>("/api/auth/login", payload);
  void payload;
  const stored = localStorage.getItem("hwai_user");
  if (!stored) throw new Error("No user in localStorage");
  return JSON.parse(stored) as AuthUser;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  // return client.post<AuthUser>("/api/auth/register", payload);
  // No local mock for account creation — this app's demo accounts are seeded, not registered through
  // the UI. Left as a real (typed) function rather than an unconditional throw so it matches every
  // other file's shape; a backend dev reads this as "not yet backed locally", not "broken".
  void payload;
  void client;
  throw new Error("register: no local mock — seed an account instead (see lib/accounts.ts)");
}

export async function logout(): Promise<void> {
  // return client.post<void>("/api/auth/logout", {});
  localStorage.removeItem("hwai_user");
}

export async function me(): Promise<AuthUser> {
  // return client.get<AuthUser>("/api/auth/me");
  const stored = localStorage.getItem("hwai_user");
  if (!stored) throw new Error("Not authenticated");
  return JSON.parse(stored) as AuthUser;
}
