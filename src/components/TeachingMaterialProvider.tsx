"use client";

import { useState, useCallback, useEffect } from "react";
import { TeachingMaterialContext, TeachingMaterial } from "@/lib/teachingMaterials";
import { removeFile } from "@/lib/fileStorage";

const LS_MATERIALS = "hwai_teaching_materials_v1";

const SEED_MATERIALS: TeachingMaterial[] = [
  {
    id: "tm-seed-c1-1", courseId: "c-mock-1", title: "เอกสารประกอบสัปดาห์ 1 — พื้นฐาน Python",
    type: "link", source: "url", ref: "https://docs.python.org/3/tutorial/",
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "tm-seed-c1-2", courseId: "c-mock-1", title: "สไลด์ปฐมนิเทศรายวิชา",
    type: "link", source: "url", ref: "https://example.com/slides/orientation.pdf",
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function TeachingMaterialProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);

  useEffect(() => {
    setMaterials(loadData<TeachingMaterial>(LS_MATERIALS, SEED_MATERIALS));
  }, []);

  const persist = useCallback((next: TeachingMaterial[]) => {
    setMaterials(next);
    localStorage.setItem(LS_MATERIALS, JSON.stringify(next));
  }, []);

  const addMaterial = useCallback((data: Omit<TeachingMaterial, "id" | "createdAt" | "updatedAt">): TeachingMaterial => {
    const now = new Date().toISOString();
    const m: TeachingMaterial = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([...materials, m]);
    return m;
  }, [materials, persist]);

  const removeMaterial = useCallback((id: string) => {
    const target = materials.find(m => m.id === id);
    if (target?.source === "upload") removeFile(target.ref);
    persist(materials.filter(m => m.id !== id));
  }, [materials, persist]);

  const getMaterialsByCourse = useCallback((courseId: string) =>
    materials.filter(m => m.courseId === courseId), [materials]);

  return (
    <TeachingMaterialContext.Provider value={{ materials, addMaterial, removeMaterial, getMaterialsByCourse }}>
      {children}
    </TeachingMaterialContext.Provider>
  );
}
