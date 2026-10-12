"use client";

import { useState, useCallback, useEffect } from "react";
import { CalibrationContext, type CalibrationRun } from "@/lib/calibration";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite, loadFailed } from "@/lib/api/sync";
import * as api from "@/lib/api/rubric-tools";

const LS_CALIBRATIONS = "hwai_calibrations_v1";

export default function CalibrationProvider({ children }: { children: React.ReactNode }) {
  // empty first, loaded in an effect — the hydration-safe pattern the other providers use
  const [runs, setRuns] = useState<CalibrationRun[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getCalibrationRuns().then(setRuns, loadFailed("calibration runs"));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_CALIBRATIONS);
      if (raw) setRuns(JSON.parse(raw) as CalibrationRun[]);
    } catch { /* unreadable → start empty */ }
  }, [resync]);

  const saveRun = useCallback((run: CalibrationRun) => {
    setRuns((prev) => {
      const next = prev.some((r) => r.id === run.id) ? prev.map((r) => (r.id === run.id ? run : r)) : [...prev, run];
      if (!API_ENABLED) {
        try { localStorage.setItem(LS_CALIBRATIONS, JSON.stringify(next)); } catch { /* storage full / blocked */ }
      }
      return next;
    });
    if (API_ENABLED) enqueueWrite(() => api.saveCalibrationRun(run), resync);
  }, [resync]);

  const removeRun = useCallback((id: string) => {
    setRuns((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (!API_ENABLED) {
        try { localStorage.setItem(LS_CALIBRATIONS, JSON.stringify(next)); } catch { /* storage full / blocked */ }
      }
      return next;
    });
    if (API_ENABLED) enqueueWrite(() => api.removeCalibrationRun(id), resync);
  }, [resync]);

  return <CalibrationContext.Provider value={{ runs, saveRun, removeRun }}>{children}</CalibrationContext.Provider>;
}
