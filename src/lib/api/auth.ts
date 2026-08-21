import { client } from "./client";

export interface AuthUser {
  name: string;
  email: string;
  role: "teacher" | "ta";
  token?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: "teacher" | "ta";
}

// Phase 1: localStorage mock — swap body to client.post() when backend is ready
export async function login(payload: LoginPayload): Promise<AuthUser> {
  // return client.post<AuthUser>("/api/auth/login", payload);
  void payload;
  const stored = localStorage.getItem("hwai_user");
  if (!stored) throw new Error("No user in localStorage");
  return JSON.parse(stored) as AuthUser;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  // return client.post<AuthUser>("/api/auth/register", payload);
  void payload;
  throw new Error("register: backend not implemented");
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
