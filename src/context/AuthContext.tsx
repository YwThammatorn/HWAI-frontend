"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { findMultiRoleAccount, identityEmail } from "@/lib/accounts";

export type UserRole = "teacher" | "ta" | "student" | "admin";

export interface AuthUser {
  name: string;
  email: string;
  /** The role the user is acting as right now. */
  role: UserRole;
  studentId?: string;
  /** Roles this account holds — only set for multi-role accounts (see lib/accounts.ts). */
  roles?: UserRole[];
  /** The email the person signed in with. `email` changes with the active role
   *  (a student persona acts as `<id>@kmitl.ac.th`), this one never does. */
  accountEmail?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  viewAs: UserRole | null;
  effectiveRole: UserRole | null;
  setViewAs: (role: UserRole | null) => void;
  login: (user: AuthUser) => void;
  logout: () => void;
  /** Multi-role accounts only: act as another role the account holds. `displayName`
   *  is the name to show for the student persona (looked up by the caller). */
  switchRole: (role: UserRole, displayName?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "hwai_user";

/** Attach the role list to a session whose sign-in email belongs to a multi-role account. */
function applyAccountRoles(u: AuthUser): AuthUser {
  const account = findMultiRoleAccount(u.accountEmail ?? u.email);
  if (!account) return u;
  const role = account.roles.includes(u.role) ? u.role : account.defaultRole;
  const next: AuthUser = {
    ...u,
    role,
    roles: account.roles,
    accountEmail: account.email,
    email: identityEmail(account, role),
    name: role === "student" ? u.name : account.name,
  };
  if (role === "student" && account.studentId) next.studentId = account.studentId;
  else delete next.studentId;
  return next;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewAs, setViewAs] = useState<UserRole | null>(null);

  const effectiveRole: UserRole | null = viewAs ?? user?.role ?? null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(applyAccountRoles(JSON.parse(stored)));
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, []);

  function persist(u: AuthUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  function login(u: AuthUser) {
    persist(applyAccountRoles(u));
    setViewAs(null);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setViewAs(null);
  }

  function switchRole(role: UserRole, displayName?: string) {
    if (!user?.roles?.includes(role)) return;
    const account = findMultiRoleAccount(user.accountEmail);
    if (!account) return;
    const next: AuthUser = {
      ...user,
      role,
      email: identityEmail(account, role),
      name: role === "student" ? displayName || account.name : account.name,
    };
    if (role === "student" && account.studentId) next.studentId = account.studentId;
    else delete next.studentId;
    persist(next);
    setViewAs(null);
  }

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, viewAs, effectiveRole, setViewAs, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
