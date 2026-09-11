"use client";

import { useState, useCallback, useEffect } from "react";
import { SectionRoleContext, SectionRole, SectionRolePermissions, defaultPermissionsFor } from "@/lib/section-roles";

const LS_KEY = "hwai_section_roles_v1";

export default function SectionRoleProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [sectionRoles, setSectionRoles] = useState<SectionRole[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSectionRoles(JSON.parse(raw) as SectionRole[]);
    } catch {}
  }, []);

  const persist = useCallback((next: SectionRole[]) => {
    setSectionRoles(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const addSectionRole = useCallback((data: Omit<SectionRole, "id" | "permissions">): SectionRole => {
    const r: SectionRole = { ...data, id: crypto.randomUUID() };
    persist([...sectionRoles, r]);
    return r;
  }, [sectionRoles, persist]);

  const removeSectionRole = useCallback((id: string) => {
    persist(sectionRoles.filter(r => r.id !== id));
  }, [sectionRoles, persist]);

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
