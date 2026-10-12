"use client";

import { useState, useCallback, useEffect } from "react";
import { RubricLibraryContext, type RubricLibraryEntry } from "@/lib/rubricLibrary";

const LS_LIBRARY = "hwai_rubric_library_v1";

export default function RubricLibraryProvider({ children }: { children: React.ReactNode }) {
  // starts empty and loads in an effect — same hydration-safe pattern as CLOProvider
  const [entries, setEntries] = useState<RubricLibraryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_LIBRARY);
      if (raw) setEntries(JSON.parse(raw) as RubricLibraryEntry[]);
    } catch { /* unreadable → start empty */ }
  }, []);

  const persist = useCallback((next: RubricLibraryEntry[]) => {
    setEntries(next);
    try { localStorage.setItem(LS_LIBRARY, JSON.stringify(next)); } catch { /* storage full / blocked */ }
  }, []);

  const addEntry = useCallback((data: Omit<RubricLibraryEntry, "id" | "createdAt">): RubricLibraryEntry => {
    const e: RubricLibraryEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    persist([...entries, e]);
    return e;
  }, [entries, persist]);

  const renameEntry = useCallback((id: string, name: string) => {
    persist(entries.map((e) => (e.id === id ? { ...e, name } : e)));
  }, [entries, persist]);

  const removeEntry = useCallback((id: string) => {
    persist(entries.filter((e) => e.id !== id));
  }, [entries, persist]);

  return (
    <RubricLibraryContext.Provider value={{ entries, addEntry, renameEntry, removeEntry }}>
      {children}
    </RubricLibraryContext.Provider>
  );
}
