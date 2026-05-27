const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.mediarosenqvist.com";
import { supabase } from "@/integrations/supabase/client";

export const apiBase = () => API_BASE;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Authenticated fetch: attaches Supabase access_token as Bearer for protected backend calls. */
export async function apiAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export function previewUrl(trackId: string) {
  return `${API_BASE}/playback/${encodeURIComponent(trackId)}/preview`;
}

/** Authenticated JSON request (GET/POST/PATCH/DELETE) with a JSON body. */
export async function apiAuthedJson<T>(
  path: string,
  body?: unknown,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `API ${res.status} ${res.statusText} on ${path}`;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.error === "string") msg = parsed.error;
      else if (typeof parsed?.message === "string") msg = parsed.message;
      else if (typeof parsed?.detail === "string") msg = parsed.detail;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  try {
    return (text ? JSON.parse(text) : ({} as T)) as T;
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

/** Raw PUT of a File/Blob to an external signed URL (e.g. R2) with progress. No auth header. */
export async function putSignedUpload(
  url: string,
  file: Blob,
  onProgress?: (pct: number) => void,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Default to the file's content type; presigners often sign with this header.
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) xhr.setRequestHeader(k, v);
    }
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

export type ArtistProfile = {
  id: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
};

/** Authenticated multipart upload with progress (XHR — fetch has no upload progress event). */
export async function apiAuthedUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      const text = xhr.responseText;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(text ? (JSON.parse(text) as T) : ({} as T));
        } catch {
          reject(new Error("Invalid JSON response from server"));
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.error === "string") message = parsed.error;
        else if (typeof parsed?.message === "string") message = parsed.message;
        else if (typeof parsed?.detail === "string") message = parsed.detail;
      } catch {
        if (text) message = text;
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.send(formData);
  });
}

export type Track = {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  art?: string;
  duration?: number;
  source?: string;
  externalId?: string;
  releaseId?: string;
  [k: string]: unknown;
};

export type Artist = {
  id: string;
  name?: string;
  imageUrl?: string;
  [k: string]: unknown;
};

export type Release = {
  id: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
  releaseDate?: string;
  [k: string]: unknown;
};

export type NowPlaying = {
  source: string;
  station?: string;
  nowPlaying?: {
    title?: string;
    artist?: string;
    album?: string;
    art?: string;
    duration?: number;
    playedAt?: string;
  };
  tracks?: Array<{
    source: string;
    externalId?: string;
    title?: string;
    artist?: string;
    art?: string;
  }>;
};

export type ListResp<T> = { items: T[] };