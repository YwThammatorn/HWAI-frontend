"use client";

import { createContext, Fragment, useContext, useEffect, useRef, useState } from "react";
import { findMultiRoleAccount, identityEmail } from "@/lib/accounts";
import { API_ENABLED, setSignedIn, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import * as authApi from "@/lib/api/auth";
import DemoBanner from "@/components/DemoBanner";

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
  /** Signed in through the backend's demo sign-in (API mode) — the UI shows a banner. */
  demo?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  viewAs: UserRole | null;
  effectiveRole: UserRole | null;
  setViewAs: (role: UserRole | null) => void;
  /** Mock mode: start a session for `user`. API mode: pass the session the API just started
   *  (authApi.userFromMe after demoLogin). */
  login: (user: AuthUser, me?: authApi.Me) => void;
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

function storedUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null; // ignore corrupt storage
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewAs, setViewAs] = useState<UserRole | null>(null);
  // API mode: what the backend says about the session (who, and which roles).
  const meRef = useRef<authApi.Me | null>(null);

  const effectiveRole: UserRole | null = viewAs ?? user?.role ?? null;

  useEffect(() => {
    if (!API_ENABLED) {
      const stored = storedUser();
      if (stored) setUser(applyAccountRoles(stored));
      setLoaded(true);
      return;
    }
    // The session cookie is HttpOnly — ask the API who it belongs to. localStorage only remembers
    // which of their roles the user was acting as.
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        meRef.current = me;
        setSignedIn(true);
        const next = authApi.userFromMe(me, storedUser()?.role);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API answered 401 (session expired or ended elsewhere): sign the UI out — the shells send
  // the user to /login.
  useEffect(() => {
    if (!API_ENABLED) return;
    const onUnauthorized = () => {
      meRef.current = null;
      setSignedIn(false);
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setViewAs(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  function persist(u: AuthUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  function login(u: AuthUser, me?: authApi.Me) {
    if (API_ENABLED) {
      meRef.current = me ?? meRef.current;
      setSignedIn(true);
      persist(u);
    } else {
      persist(applyAccountRoles(u));
    }
    setViewAs(null);
  }

  function logout() {
    if (API_ENABLED) {
      meRef.current = null;
      setSignedIn(false);
      authApi.logout().catch((err) => console.warn("[api] logout failed", err));
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setViewAs(null);
  }

  function switchRole(role: UserRole, displayName?: string) {
    if (!user?.roles?.includes(role)) return;
    if (API_ENABLED) {
      if (!meRef.current) return;
      persist(authApi.userFromMe(meRef.current, role));
      setViewAs(null);
      return;
    }
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
      {/* API mode: the data Providers below load once, on mount — remount them whenever a different
          account signs in (or out) so they load what this account may see. */}
      <Fragment key={API_ENABLED ? (user?.accountEmail ?? "signed-out") : "local"}>{children}</Fragment>
      {user?.demo && <DemoBanner email={user.accountEmail ?? user.email} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
