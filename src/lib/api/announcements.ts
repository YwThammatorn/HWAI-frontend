import { client } from "./client";
import type { Announcement } from "@/lib/announcements";

const KEY = "hwai_announcements_v1";

function read(): Announcement[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Announcement[]) : [];
  } catch {
    return [];
  }
}

function write(items: Announcement[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// AnnouncementContextValue (src/lib/announcements.ts) 1:1. `scope: "all-sections"` fan-out
// (announcementReachesCourse in lib/announcements.ts) is computed client-side today by matching
// courseTemplateId/term/academicYear against every locally-loaded Course — a real backend can either
// keep doing that (return every announcement, let the client filter) or resolve the fan-out
// server-side and only return what's relevant to the requested course; either way this function's
// signature (one course in, its announcements out) doesn't need to change.
export async function getAnnouncements(authorCourseId?: string): Promise<Announcement[]> {
  // return client.get<Announcement[]>(authorCourseId ? `/api/courses/${authorCourseId}/announcements` : "/api/announcements");
  void client;
  const all = read();
  return authorCourseId ? all.filter((a) => a.authorCourseId === authorCourseId) : all;
}

export async function addAnnouncement(data: Omit<Announcement, "id" | "createdAt" | "updatedAt">): Promise<Announcement> {
  // return client.post<Announcement>(`/api/courses/${data.authorCourseId}/announcements`, data);
  const now = new Date().toISOString();
  const item: Announcement = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function removeAnnouncement(id: string): Promise<void> {
  // return client.delete<void>(`/api/announcements/${id}`);
  write(read().filter((a) => a.id !== id));
}
