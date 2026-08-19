"use client";

import { useState, useEffect, useCallback } from "react";
import { CLOContext, CLO } from "@/lib/clo";

const LS_CLOS = "hwai_clos_v1";

const SEED_CLOS: CLO[] = [
  {
    id: "clo-seed-1-1", courseId: "seed-1",
    code: "CLO1",
    text: "นักศึกษาสามารถวิเคราะห์ความต้องการของผู้ใช้และสังเคราะห์เป็น User Persona และ Journey Map ได้",
    ploMapping: ["PLO1", "PLO2"],
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "clo-seed-1-2", courseId: "seed-1",
    code: "CLO2",
    text: "นักศึกษาสามารถออกแบบ Interface ที่สอดคล้องกับหลักการ Usability และ Accessibility ได้",
    ploMapping: ["PLO2", "PLO3"],
    createdAt: "2026-07-01T09:05:00.000Z", updatedAt: "2026-07-01T09:05:00.000Z",
  },
  {
    id: "clo-seed-1-3", courseId: "seed-1",
    code: "CLO3",
    text: "นักศึกษาสามารถสร้าง Prototype ทดสอบกับผู้ใช้จริง วิเคราะห์ผล และปรับปรุงงานออกแบบได้",
    ploMapping: ["PLO3"],
    createdAt: "2026-07-01T09:10:00.000Z", updatedAt: "2026-07-01T09:10:00.000Z",
  },
  {
    id: "clo-seed-2-1", courseId: "seed-2",
    code: "CLO1",
    text: "นักศึกษาสามารถออกแบบ Interaction Flow ที่ชัดเจนและสอดคล้องกับ Mental Model ของผู้ใช้",
    ploMapping: ["PLO2"],
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "clo-seed-2-2", courseId: "seed-2",
    code: "CLO2",
    text: "นักศึกษาสามารถดำเนินการ Usability Testing และนำเสนอผลการประเมินเพื่อปรับปรุงงานออกแบบ",
    ploMapping: ["PLO1", "PLO3"],
    createdAt: "2026-07-01T09:05:00.000Z", updatedAt: "2026-07-01T09:05:00.000Z",
  },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function CLOProvider({ children }: { children: React.ReactNode }) {
  const [clos, setClos] = useState<CLO[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setClos(loadData<CLO>(LS_CLOS, SEED_CLOS));
    setReady(true);
  }, []);

  const persist = useCallback((next: CLO[]) => {
    setClos(next);
    localStorage.setItem(LS_CLOS, JSON.stringify(next));
  }, []);

  const addCLO = useCallback((data: Omit<CLO, "id" | "createdAt" | "updatedAt">): CLO => {
    const now = new Date().toISOString();
    const c: CLO = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([...clos, c]);
    return c;
  }, [clos, persist]);

  const updateCLO = useCallback((id: string, data: Partial<Omit<CLO, "id" | "courseId" | "createdAt" | "updatedAt">>) => {
    persist(clos.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c));
  }, [clos, persist]);

  const removeCLO = useCallback((id: string) => {
    persist(clos.filter(c => c.id !== id));
  }, [clos, persist]);

  const getCLO = useCallback((id: string) => clos.find(c => c.id === id), [clos]);

  const getCLOsByCourse = useCallback((courseId: string) =>
    clos.filter(c => c.courseId === courseId), [clos]);

  if (!ready) return null;

  return (
    <CLOContext.Provider value={{ clos, addCLO, updateCLO, removeCLO, getCLO, getCLOsByCourse }}>
      {children}
    </CLOContext.Provider>
  );
}
