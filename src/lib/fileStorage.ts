"use client";

const LS_PREFIX = "hwai_file_";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — localStorage has no real capacity for larger blobs

export class FileTooLargeError extends Error {}

/**
 * Mock-only file storage: reads the file into a data: URL and keeps it in
 * localStorage under a generated key. This is the ONLY module that knows
 * files currently live in localStorage — swap these two functions for a
 * real upload API (e.g. POST to /api/upload, GET the returned URL) when a
 * backend exists. Every caller in the app only ever sees storeFile() /
 * resolveFileUrl(), never the underlying mechanism.
 */
export async function storeFile(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new FileTooLargeError(`File exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB mock storage limit`);
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
  return localStorage.getItem(key);
}

export function removeFile(key: string): void {
  localStorage.removeItem(key);
}
