"use client";
import { useState, useCallback } from "react";

/** Manages which nav-group ids are expanded. */
export function useNavCollapse(initialOpen: string[] = []) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen));

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const isOpen = useCallback((id: string) => open.has(id), [open]);

  return { isOpen, toggle };
}
