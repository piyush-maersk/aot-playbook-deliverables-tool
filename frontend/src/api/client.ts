// Typed API client: bearer token, JSON, 409/410 surfaced as ApiError with the server payload.
const BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

let tokenProvider: () => Promise<string | null> = async () => null;
export const setTokenProvider = (fn: () => Promise<string | null>) => {
  tokenProvider = fn;
};

export const apiUrl = (path: string) => `${BASE}${path}`;

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData; keepalive?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()) };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(apiUrl(path), { method: init.method ?? "GET", headers, body, keepalive: init.keepalive });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const detail = typeof data === "object" && data && "detail" in data ? (data as { detail: unknown }).detail : text;
    throw new ApiError(res.status, data, typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Fetch a protected file (e.g. layout image) and return an object URL. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), { headers: await authHeaders() });
  if (!res.ok) throw new ApiError(res.status, null, "Could not load file");
  return URL.createObjectURL(await res.blob());
}
