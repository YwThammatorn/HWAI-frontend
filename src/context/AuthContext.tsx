"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "teacher" | "ta" | "student" | "admin";

export interface AuthUser {
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  viewAs: UserRole | null;
  effectiveRole: UserRole | null;
  setViewAs: (role: UserRole | null) => void;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "hwai_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewAs, setViewAs] = useState<UserRole | null>(null);

  const effectiveRole: UserRole | null = viewAs ?? user?.role ?? null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true);
  }, []);

  function login(u: AuthUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setViewAs(null);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setViewAs(null);
  }

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, viewAs, effectiveRole, setViewAs, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
