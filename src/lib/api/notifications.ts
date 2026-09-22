import { client } from "./client";
import type { Notif } from "@/lib/notifications";

// Speculative, unlike every other file in this folder: there is no live Provider/Context to mirror
// here (the bell is behind NOTIFICATIONS_DISABLED in lib/featureFlags.ts, and even when it was on,
// teacher/notifications/page.tsx + Navbar.tsx held notifications in plain useState — never persisted
// to localStorage). This is a reasonable contract for when the feature gets real persistence, not a
// snapshot of live behavior — the key below is invented for this file, not read anywhere else.
const KEY = "hwai_notifications_v1";

function readLocal(): Notif[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as Array<Notif & { createdAt: string }>;
    return items.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }));
  } catch {
    return [];
  }
}

function writeLocal(items: Notif[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready
export async function getNotifications(): Promise<Notif[]> {
  // return client.get<Notif[]>("/api/notifications");
  void client;
  return readLocal();
}

export async function markRead(id: string): Promise<void> {
  // return client.patch<void>(`/api/notifications/${id}/read`, {});
  writeLocal(readLocal().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export async function markAllRead(): Promise<void> {
  // return client.post<void>("/api/notifications/read-all", {});
  writeLocal(readLocal().map((n) => ({ ...n, read: true })));
}

export async function dismissNotification(id: string): Promise<void> {
  // return client.delete<void>(`/api/notifications/${id}`);
  writeLocal(readLocal().filter((n) => n.id !== id));
}
