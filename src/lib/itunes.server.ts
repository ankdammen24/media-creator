/**
 * iTunes Search API helpers (server-only).
 * Free, no auth, no rate-limit headers — Apple guidelines suggest ~20 req/min.
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

const BASE = "https://itunes.apple.com/search";
const COUNTRY = "SE";

type ItunesResult = {
  artworkUrl100?: string;
  artworkUrl60?: string;
  collectionName?: string;
  artistName?: string;
  wrapperType?: string;
  kind?: string;
};

type ItunesResponse = { resultCount: number; results: ItunesResult[] };

/** Upgrade Apple's `100x100bb.jpg`-style URL to 1000x1000. */
function upscale(url: string, size = 1000): string {
  return url.replace(/\/\d+x\d+bb(-\d+)?\.(jpg|png|jpeg)$/i, `/${size}x${size}bb.jpg`);
}

async function search(params: Record<string, string>): Promise<ItunesResponse | null> {
  const qs = new URLSearchParams({ country: COUNTRY, ...params });
  try {
    const res = await fetch(`${BASE}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as ItunesResponse;
  } catch {
    return null;
  }
}

/**
 * For an artist name, returns the cover art of their most recent/relevant
 * album as a high-res square image URL — used as artist avatar proxy.
 */
export async function searchArtistImage(name: string): Promise<string | null> {
  const term = name.trim();
  if (!term) return null;
  const data = await search({ term, entity: "album", limit: "1", attribute: "artistTerm" });
  const hit = data?.results?.[0]?.artworkUrl100;
  return hit ? upscale(hit) : null;
}

/** For an album title + artist name, returns the album cover URL. */
export async function searchAlbumImage(
  title: string,
  artistName: string | null,
): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;
  const term = artistName ? `${artistName} ${t}` : t;
  const data = await search({ term, entity: "album", limit: "1" });
  const hit = data?.results?.[0]?.artworkUrl100;
  if (hit) return upscale(hit);
  // Fallback: Deezer
  return await searchAlbumImageDeezer(t, artistName);
}

/**
 * Deezer fallback for album cover search. Public API, no auth.
 * Docs: https://developers.deezer.com/api/search
 */
export async function searchAlbumImageDeezer(
  title: string,
  artistName: string | null,
): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;
  const q = artistName
    ? `artist:"${artistName}" album:"${t}"`
    : `album:"${t}"`;
  try {
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ cover_xl?: string; cover_big?: string; cover_medium?: string }>;
    };
    const hit = json.data?.[0];
    return hit?.cover_xl || hit?.cover_big || hit?.cover_medium || null;
  } catch {
    return null;
  }
}

/** Download a remote image into a Blob; returns null on failure. */
export async function downloadImage(
  url: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const blob = await res.blob();
    return { blob, contentType };
  } catch {
    return null;
  }
}