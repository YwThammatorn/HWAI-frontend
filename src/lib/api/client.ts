const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * True when NEXT_PUBLIC_API_URL points at HWAI-backend (e.g. "http://localhost:4000"). The admin-domain
 * Providers (courses, curriculum, managed teachers, cohort students) then load/save through the API;
 * unset, every Provider keeps using localStorage as before (the Playwright suites rely on that).
 */
export const API_ENABLED = BASE_URL !== "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem("hwai_user") ?? "null")?.token;
          } catch {
            return undefined;
          }
        })()
      : undefined;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
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
