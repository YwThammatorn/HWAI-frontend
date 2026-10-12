const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * True when NEXT_PUBLIC_API_URL points at HWAI-backend (e.g. "http://localhost:4000"). The admin-domain
 * Providers (courses, curriculum, managed teachers, cohort students) then load/save through the API;
 * unset, every Provider keeps using localStorage as before (the Playwright suites rely on that).
 * Signing in then goes through the API too (an HttpOnly session cookie) — see lib/api/auth.ts.
 */
export const API_ENABLED = BASE_URL !== "";

/** Absolute URL of an API path, for requests that can't go through `client` (raw file uploads, <img src>). */
export const apiUrl = (path: string) => `${BASE_URL}${path}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fired when the API says the session is gone (401) — AuthProvider then signs the UI out. */
export const UNAUTHORIZED_EVENT = "hwai:unauthorized";

// Whether a session exists, as AuthProvider knows it. Signed out, every Provider still mounts (they
// wrap the login page too) — their loads are answered here with a 401 instead of a round trip.
let signedIn = false;
export function setSignedIn(value: boolean) {
  signedIn = value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!signedIn && !path.startsWith("/api/auth/")) throw new ApiError(401, "Not signed in");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // the HttpOnly session cookie (hwai_session) — the page never sees it
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const client = {
  get: <T>(path: string, init?: Omit<RequestInit, "method">) =>
    request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body: unknown, init?: Omit<RequestInit, "method" | "body">) =>
    request<T>(path, { ...init, method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, init?: Omit<RequestInit, "method" | "body">) =>
    request<T>(path, { ...init, method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, init?: Omit<RequestInit, "method" | "body">) =>
    request<T>(path, { ...init, method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, init?: Omit<RequestInit, "method">) =>
    request<T>(path, { ...init, method: "DELETE" }),
};
