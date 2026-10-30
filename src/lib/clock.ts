"use client";

import { useEffect, useState } from "react";

// The app's "now" (15/10/2569). Everything that opens or closes on a deadline (submitting, grading) reads the time here, so a demo can move
// the clock without waiting for tomorrow: localStorage["hwai_clock_offset_min"] = minutes to add (see the seed command). Tests use
// Playwright's page.clock instead. Without the key it is exactly Date.now().
const KEY = "hwai_clock_offset_min";

export function appNow(): number {
  let offsetMin = 0;
  try { offsetMin = Number(localStorage.getItem(KEY) ?? 0) || 0; } catch { /* storage blocked: real time */ }
  return Date.now() + offsetMin * 60_000;
}

/** The time as state, refreshed every `intervalMs`, so a screen left open flips when a window closes. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState<number>(() => appNow());
  useEffect(() => {
    setNow(appNow());
    const id = window.setInterval(() => setNow(appNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
