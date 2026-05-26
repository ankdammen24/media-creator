const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://api.mediarosenqvist.com";

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

export function previewUrl(trackId: string) {
  return `${API_BASE}/playback/${encodeURIComponent(trackId)}/preview`;
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