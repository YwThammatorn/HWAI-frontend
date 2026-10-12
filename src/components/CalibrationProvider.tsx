"use client";

import { useState, useCallback, useEffect } from "react";
import { CalibrationContext, type CalibrationRun } from "@/lib/calibration";

const LS_CALIBRATIONS = "hwai_calibrations_v1";

export default function CalibrationProvider({ children }: { children: React.ReactNode }) {
  // empty first, loaded in an effect — the hydration-safe pattern the other providers use
  const [runs, setRuns] = useState<CalibrationRun[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CALIBRATIONS);
      if (raw) setRuns(JSON.parse(raw) as CalibrationRun[]);
    } catch { /* unreadable → start empty */ }
  }, []);

  const saveRun = useCallback((run: CalibrationRun) => {
    setRuns((prev) => {
      const next = prev.some((r) => r.id === run.id) ? prev.map((r) => (r.id === run.id ? run : r)) : [...prev, run];
      try { localStorage.setItem(LS_CALIBRATIONS, JSON.stringify(next)); } catch { /* storage full / blocked */ }
      return next;
    });
  }, []);

  const removeRun = useCallback((id: string) => {
    setRuns((prev) => {
      const next = prev.filter((r) => r.id !== id);
      try { localStorage.setItem(LS_CALIBRATIONS, JSON.stringify(next)); } catch { /* storage full / blocked */ }
      return next;
    });
  }, []);

  return <CalibrationContext.Provider value={{ runs, saveRun, removeRun }}>{children}</CalibrationContext.Provider>;
}
