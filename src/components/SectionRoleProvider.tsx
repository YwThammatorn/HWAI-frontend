"use client";

import { useState, useCallback, useEffect } from "react";
import { SectionRoleContext, SectionRole, SectionRolePermissions, defaultPermissionsFor } from "@/lib/section-roles";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite } from "@/lib/api/sync";
import * as api from "@/lib/api/section-roles";

const LS_KEY = "hwai_section_roles_v1";

export default function SectionRoleProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [sectionRoles, setSectionRoles] = useState<SectionRole[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getSectionRoles().then(setSectionRoles, (err) => console.error("[api] load section roles", err));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSectionRoles(JSON.parse(raw) as SectionRole[]);
    } catch {}
  }, [resync]);

  const persist = useCallback((next: SectionRole[]) => {
    setSectionRoles(next);
    if (!API_ENABLED) localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addSectionRole = useCallback((data: Omit<SectionRole, "id" | "permissions">): SectionRole => {
    const r: SectionRole = { ...data, id: crypto.randomUUID() };
    persist([...sectionRoles, r]);
    sync(() => api.addSectionRole({ ...data, id: r.id }));
    return r;
  }, [sectionRoles, persist, sync]);

  const removeSectionRole = useCallback((id: string) => {
    persist(sectionRoles.filter(r => r.id !== id));
    sync(() => api.removeSectionRole(id));
  }, [sectionRoles, persist, sync]);

  // Cascade from deleting a teacher/student account. In API mode the server already removes their
  // roles with the account, so this only updates local state.
  const removeRolesByAccount = useCallback((accountId: string) => {
    persist(sectionRoles.filter(r => r.accountId !== accountId));
  }, [sectionRoles, persist]);

  const getRolesBySection = useCallback((courseId: string) =>
    sectionRoles.filter(r => r.courseId === courseId), [sectionRoles]);

  const getRolesByAccount = useCallback((accountId: string) =>
    sectionRoles.filter(r => r.accountId === accountId), [sectionRoles]);

  const hasPermission = useCallback((accountId: string, courseId: string, permission: keyof SectionRolePermissions) => {
    const role = sectionRoles.find(r => r.accountId === accountId && r.courseId === courseId);
    if (!role) return false;
    const perms = role.permissions ?? defaultPermissionsFor(role.role);
    return perms[permission];
  }, [sectionRoles]);

  return (
    <SectionRoleContext.Provider value={{
      sectionRoles, addSectionRole, removeSectionRole, removeRolesByAccount,
      getRolesBySection, getRolesByAccount, hasPermission,
    }}>
      {children}
    </SectionRoleContext.Provider>
  );
}
