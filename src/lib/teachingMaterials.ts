"use client";

import { createContext, useContext } from "react";

export type TeachingMaterialType = "link" | "file" | "recording";

export interface TeachingMaterial {
  id: string;
  courseId: string;
  title: string;
  type: TeachingMaterialType;
  /**
   * "url": `ref` is an external link, used as-is.
   * "upload": `ref` is a storage key — resolve with resolveFileUrl() from
   * @/lib/fileStorage before rendering. Keeping the two apart at the data
   * layer is what lets "upload" switch to a real backend later without
   * touching anything that reads TeachingMaterial.
   */
  source: "url" | "upload";
  ref: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingMaterialContextValue {
  materials: TeachingMaterial[];
  addMaterial: (data: Omit<TeachingMaterial, "id" | "createdAt" | "updatedAt">) => TeachingMaterial;
  removeMaterial: (id: string) => void;
  getMaterialsByCourse: (courseId: string) => TeachingMaterial[];
}

export const TeachingMaterialContext = createContext<TeachingMaterialContextValue | null>(null);

export function useTeachingMaterials(): TeachingMaterialContextValue {
  const ctx = useContext(TeachingMaterialContext);
  if (!ctx) throw new Error("useTeachingMaterials must be used within TeachingMaterialProvider");
  return ctx;
}
