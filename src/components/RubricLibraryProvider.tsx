"use client";

import { useState, useCallback, useEffect } from "react";
import { RubricLibraryContext, type RubricLibraryEntry } from "@/lib/rubricLibrary";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite } from "@/lib/api/sync";
import * as api from "@/lib/api/rubric-tools";

const LS_LIBRARY = "hwai_rubric_library_v1";

export default function RubricLibraryProvider({ children }: { children: React.ReactNode }) {
  // starts empty and loads in an effect — same hydration-safe pattern as CLOProvider
  const [entries, setEntries] = useState<RubricLibraryEntry[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getRubricLibrary().then(setEntries, (err) => console.error("[api] load rubric library", err));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_LIBRARY);
      if (raw) setEntries(JSON.parse(raw) as RubricLibraryEntry[]);
    } catch { /* unreadable → start empty */ }
  }, [resync]);

  const persist = useCallback((next: RubricLibraryEntry[]) => {
    setEntries(next);
    if (API_ENABLED) return;
    try { localStorage.setItem(LS_LIBRARY, JSON.stringify(next)); } catch { /* storage full / blocked */ }
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addEntry = useCallback((data: Omit<RubricLibraryEntry, "id" | "createdAt">): RubricLibraryEntry => {
    const e: RubricLibraryEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    persist([...entries, e]);
    sync(() => api.addRubricLibraryEntry({ ...data, id: e.id }));
    return e;
  }, [entries, persist, sync]);

  const renameEntry = useCallback((id: string, name: string) => {
    persist(entries.map((e) => (e.id === id ? { ...e, name } : e)));
    sync(() => api.renameRubricLibraryEntry(id, name));
  }, [entries, persist, sync]);

  const removeEntry = useCallback((id: string) => {
    persist(entries.filter((e) => e.id !== id));
    sync(() => api.removeRubricLibraryEntry(id));
  }, [entries, persist, sync]);

  return (
    <RubricLibraryContext.Provider value={{ entries, addEntry, renameEntry, removeEntry }}>
      {children}
    </RubricLibraryContext.Provider>
  );
}
