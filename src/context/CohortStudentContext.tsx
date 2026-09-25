"use client";

import { useState, useEffect, useCallback } from "react";
import { CohortStudentContext, CohortStudent } from "@/lib/cohort-students";
import { useSectionRoles } from "@/lib/section-roles";
import { useGradingAssignments } from "@/lib/grading-assignments";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite } from "@/lib/api/sync";
import * as api from "@/lib/api/cohort-students";

const STORAGE_KEY = "hwai_cohort_students_v1";

function uuid() {
  return crypto.randomUUID();
}

export default function CohortStudentProvider({ children }: { children: React.ReactNode }) {
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  const { removeRolesByAccount } = useSectionRoles();
  const { removeAssignmentsByTa } = useGradingAssignments();

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getCohortStudents().then(setCohortStudents, (err) => console.error("[api] load cohort students", err));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCohortStudents(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
  }, [resync]);

  function persist(next: CohortStudent[]) {
    setCohortStudents(next);
    if (!API_ENABLED) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  /** API mode only: send a write to the server after the optimistic local update. */
  function sync(task: () => Promise<unknown>) {
    if (API_ENABLED) enqueueWrite(task, resync);
  }

  function addCohortStudents(incoming: Omit<CohortStudent, "id">[]) {
    const added = incoming.map((s) => ({ ...s, id: uuid() }));
    persist([...cohortStudents, ...added]);
    sync(() => api.addCohortStudents(added));
  }

  function updateCohortStudent(id: string, data: Partial<Omit<CohortStudent, "id">>) {
    persist(cohortStudents.map((s) => (s.id === id ? { ...s, ...data } : s)));
    sync(() => api.updateCohortStudent(id, data));
  }

  function removeCohortStudent(id: string) {
    persist(cohortStudents.filter((s) => s.id !== id));
    sync(() => api.removeCohortStudent(id));
    removeRolesByAccount(id); // cascade
    removeAssignmentsByTa(id); // cascade
  }

  function findByStudentId(studentId: string) {
    return cohortStudents.find((s) => s.studentId === studentId);
  }

  return (
    <CohortStudentContext.Provider
      value={{
        cohortStudents,
        addCohortStudents,
        updateCohortStudent,
        removeCohortStudent,
        findByStudentId,
      }}
    >
      {children}
    </CohortStudentContext.Provider>
  );
}
