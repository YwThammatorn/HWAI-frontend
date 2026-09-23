// Helpers for the Providers that are wired to the real backend (admin domains: courses, curriculum,
// managed teachers, cohort students — see API_CONTRACT.md "Admin backend wiring").
//
// Those Providers keep their synchronous, optimistic API (state updates immediately, ids are generated
// client-side and sent to the server) and push each write through `enqueueWrite`. Writes run strictly
// one after another, across every Provider, so dependent calls made in the same tick — e.g. the admin
// "create course" modal calling addCourse() then assignToCourse(created.id) — reach the server in order.

let queue: Promise<void> = Promise.resolve();

/**
 * Queue a server write. If it fails, `onError` runs — Providers pass their `resync` there so local
 * state snaps back to what the server actually has.
 */
export function enqueueWrite(task: () => Promise<unknown>, onError: () => void): void {
  queue = queue.then(() =>
    task().then(
      () => undefined,
      (err: unknown) => {
        console.error("[api] write failed", err);
        if (typeof window !== "undefined") {
          const detail = err instanceof Error ? err.message : String(err);
          window.alert(`บันทึกข้อมูลไม่สำเร็จ / Failed to save\n\n${detail}`);
        }
        onError();
      },
    ),
  );
}

/**
 * JSON.stringify drops `undefined`, so `{ title: undefined }` (how the forms clear an optional field)
 * would never reach the server. Send those keys as `null` instead — the backend treats null as "clear".
 */
export function withNulls<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v])) as T;
}
