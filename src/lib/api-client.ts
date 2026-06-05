// Thin fetch wrapper for the external Media Rosenqvist API.
// All requests carry the current Supabase access token as a Bearer header.
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "https://api.mediarosenqvist.com").replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type ApiOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth header (rare — only for endpoints documented as public). */
  anonymous?: boolean;
};

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers = {}, anonymous, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (!anonymous) {
    const token = await getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let finalBody: BodyInit | undefined;
  if (body !== undefined) {
    if (body instanceof FormData || body instanceof Blob || typeof body === "string") {
      finalBody = body as BodyInit;
    } else {
      finalBody = JSON.stringify(body);
      finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json";
    }
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    if (res.status === 401 && !anonymous) {
      // Token rejected — sign out so the auth gate handles redirect.
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    const msg =
      (isJson && payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ??
      (typeof payload === "string" && payload.length > 0 ? payload : null) ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<ApiOptions, "body">) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<ApiOptions, "body">) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<ApiOptions, "body">) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<ApiOptions, "body">) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<ApiOptions, "body">) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};
