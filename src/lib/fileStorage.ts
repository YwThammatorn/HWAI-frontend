"use client";

import { API_ENABLED, apiUrl } from "@/lib/api/client";

const LS_PREFIX = "hwai_file_";

/** Per-file upload limit: 10MB on HWAI-backend (files live in PostgreSQL), 2MB in localStorage mock mode. */
export const MAX_FILE_MB = API_ENABLED ? 10 : 2;
const MAX_SIZE_BYTES = MAX_FILE_MB * 1024 * 1024;

export class FileTooLargeError extends Error {}

/**
 * The ONLY module that knows where uploaded files live. Callers only ever see storeFile() →
 * a key, resolveFileUrl(key) → a URL they can fetch or show, and removeFile(key).
 *
 * - API mode (NEXT_PUBLIC_API_URL set): the file is uploaded to HWAI-backend (POST /api/files) and
 *   the key is its file id, served at GET /api/files/:id.
 * - Otherwise (mock): the file becomes a data: URL in localStorage under a `hwai_file_` key.
 *
 * Keys are told apart by that prefix, so data made in mock mode still resolves after switching.
 */
export async function storeFile(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new FileTooLargeError(`File exceeds the ${MAX_FILE_MB}MB limit`);
  }
  if (API_ENABLED) {
    const res = await fetch(apiUrl("/api/files"), {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
    if (res.status === 413) throw new FileTooLargeError(`File exceeds the ${MAX_FILE_MB}MB limit`);
    if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text().catch(() => "")}`);
    const { id } = (await res.json()) as { id: string };
    return id;
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const key = `${LS_PREFIX}${crypto.randomUUID()}`;
  localStorage.setItem(key, dataUrl);
  return key;
}

export function resolveFileUrl(key: string): string | null {
  if (key.startsWith(LS_PREFIX)) return localStorage.getItem(key);
  return API_ENABLED ? apiUrl(`/api/files/${encodeURIComponent(key)}`) : null;
}

/** Best-effort: freeing storage never blocks or fails the action that no longer needs the file. */
export function removeFile(key: string): void {
  if (key.startsWith(LS_PREFIX)) {
    localStorage.removeItem(key);
    return;
  }
  if (!API_ENABLED) return;
  fetch(apiUrl(`/api/files/${encodeURIComponent(key)}`), { method: "DELETE" }).catch((err) =>
    console.warn("[api] could not delete file", key, err),
  );
}
