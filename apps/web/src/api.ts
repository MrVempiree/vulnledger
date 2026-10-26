/**
 * @fileoverview VulnLedger API client.
 *
 * Thin fetch wrapper that:
 * - Sends credentials (cookies) with every request
 * - Attaches the CSRF token on state-changing methods
 * - Parses JSON responses and throws structured errors on non-ok status
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

interface ApiError extends Error {
  status: number;
  body?: any;
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const isStateChanging = !options.method ||
    ["POST", "PUT", "PATCH", "DELETE"].includes(options.method as string);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (isStateChanging) {
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf_token="))
      ?.split("=")[1];
    if (csrfToken) {
      headers["X-CSRF-TOKEN"] = csrfToken;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text();

  if (!res.ok) {
    const err: ApiError = new Error(
      body?.error || `Request failed with status ${res.status}`,
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: any) =>
    request(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  patch: (path: string, body?: any) =>
    request(path, { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
