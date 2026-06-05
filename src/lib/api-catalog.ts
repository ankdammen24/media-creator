// Public catalog API — anonymous endpoints on the Media Rosenqvist API.
//
//   GET /tracks         -> { tracks: CatalogTrack[] }
//   GET /tracks/:id     -> { track: CatalogTrack }
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api-client";

export type CatalogTrack = {
  id: string;
  title: string;
  artistName?: string | null;
  artist_name?: string | null;
  albumTitle?: string | null;
  album_title?: string | null;
  artworkUrl?: string | null;
  artwork_url?: string | null;
  previewUrl?: string | null;
  preview_url?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  isrc?: string | null;
  durationSeconds?: number | null;
  duration_seconds?: number | null;
  genres?: string[];
};

export function listCatalogTracks() {
  return apiFetch<{ tracks: CatalogTrack[] }>("/tracks", { anonymous: true });
}

export function getCatalogTrack(trackId: string) {
  return apiFetch<{ track: CatalogTrack }>(
    `/tracks/${encodeURIComponent(trackId)}`,
    { anonymous: true },
  );
}

export const catalogQueryKeys = {
  tracks: ["catalog", "tracks"] as const,
  track: (id: string) => ["catalog", "tracks", id] as const,
};

export function useCatalogTracks() {
  return useQuery({ queryKey: catalogQueryKeys.tracks, queryFn: listCatalogTracks });
}

export function useCatalogTrack(trackId: string) {
  return useQuery({
    queryKey: catalogQueryKeys.track(trackId),
    queryFn: () => getCatalogTrack(trackId),
    enabled: !!trackId,
  });
}

export function catalogArtworkUrl(track: CatalogTrack) {
  return track.artworkUrl ?? track.artwork_url ?? null;
}
export function catalogArtistName(track: CatalogTrack) {
  return track.artistName ?? track.artist_name ?? "Unknown artist";
}
export function catalogAlbumTitle(track: CatalogTrack) {
  return track.albumTitle ?? track.album_title ?? null;
}
export function catalogReleaseDate(track: CatalogTrack) {
  return track.releaseDate ?? track.release_date ?? null;
}
