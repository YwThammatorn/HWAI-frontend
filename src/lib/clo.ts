"use client";

import { createContext, useContext } from "react";

export interface CLO {
  id: string;
  courseId: string;
  code: string;
  text: string;
  ploMapping: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CLOContextValue {
  clos: CLO[];
  addCLO: (data: Omit<CLO, "id" | "createdAt" | "updatedAt">) => CLO;
  updateCLO: (id: string, data: Partial<Omit<CLO, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeCLO: (id: string) => void;
  getCLO: (id: string) => CLO | undefined;
  getCLOsByCourse: (courseId: string) => CLO[];
}

export const CLOContext = createContext<CLOContextValue | null>(null);

export function useCLOs(): CLOContextValue {
  const ctx = useContext(CLOContext);
  if (!ctx) throw new Error("useCLOs must be used within CLOProvider");
  return ctx;
}
