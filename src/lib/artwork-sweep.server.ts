import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  downloadImage,
  searchTrackImageVerified,
  searchTrackImageDeezerVerified,
  searchTrackImageCoverArtArchive,
} from "@/lib/itunes.server";
import { generateTrackFallbackImage } from "@/lib/ai-image.server";

const BUCKET = "artwork";

export type RegenerateSource = "itunes" | "deezer" | "musicbrainz" | "ai" | "failed";

export type RegenerateResult = {
  scanned: number;
  updated: number;
  failed: number;
  bySource: Record<RegenerateSource, number>;
  details: Array<{
    id: string;
    name: string;
    ok: boolean;
    source: RegenerateSource;
    reason?: string;
  }>;
};

function emptyResult(scanned: number): RegenerateResult {
  return {
    scanned,
    updated: 0,
    failed: 0,
    bySource: { itunes: 0, deezer: 0, musicbrainz: 0, ai: 0, failed: 0 },
    details: [],
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadAuto(
  folder: "albums" | "tracks",
  id: string,
  url: string,
): Promise<string | null> {
  const dl = await downloadImage(url);
  if (!dl) return null;
  const ext = dl.contentType.includes("png") ? "png" : "jpg";
  const path = `auto/${folder}/${id}-${Date.now()}.${ext}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, dl.blob, {
    contentType: dl.contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) return null;
  return path;
}

async function uploadBlob(
  folder: "albums" | "tracks",
  id: string,
  blob: Blob,
  contentType: string,
): Promise<string | null> {
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `auto/${folder}/${id}-${Date.now()}.${ext}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (up.error) return null;
  return path;
}

export async function sweepAzuracastTracks(limit = 50): Promise<RegenerateResult> {
  const { data: rows, error } = await supabaseAdmin
    .from("submissions")
    .select("id, title, artwork_path, artist_profiles!submissions_artist_profile_id_fkey(name)")
    .ilike("artwork_path", "%/azuracast/%")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as unknown as Array<{
    id: string;
    title: string;
    artwork_path: string | null;
    artist_profiles: { name: string } | null;
  }>;

  const result = emptyResult(list.length);

  for (const track of list) {
    const artistName = track.artist_profiles?.name ?? "";
    const label = artistName ? `${artistName} – ${track.title}` : track.title;
    try {
      let path: string | null = null;
      let source: RegenerateSource = "failed";

      if (artistName) {
        const url = await searchTrackImageVerified(artistName, track.title);
        if (url) {
          path = await uploadAuto("tracks", track.id, url);
          if (path) source = "itunes";
        }
      }
      if (!path && artistName) {
        const url = await searchTrackImageDeezerVerified(artistName, track.title);
        if (url) {
          path = await uploadAuto("tracks", track.id, url);
          if (path) source = "deezer";
        }
      }
      if (!path && artistName) {
        const url = await searchTrackImageCoverArtArchive(artistName, track.title);
        if (url) {
          path = await uploadAuto("tracks", track.id, url);
          if (path) source = "musicbrainz";
        }
      }
      if (!path) {
        const ai = await generateTrackFallbackImage(artistName || "Unknown Artist", track.title);
        if (ai) {
          path = await uploadBlob("tracks", track.id, ai.blob, ai.contentType);
          if (path) source = "ai";
        }
      }

      if (!path) {
        result.failed++;
        result.bySource.failed++;
        result.details.push({ id: track.id, name: label, ok: false, source: "failed", reason: "no-image-produced" });
      } else {
        const { error: upErr } = await supabaseAdmin
          .from("submissions")
          .update({ artwork_path: path })
          .eq("id", track.id);
        if (upErr) {
          result.failed++;
          result.bySource.failed++;
          result.details.push({ id: track.id, name: label, ok: false, source: "failed", reason: upErr.message });
        } else {
          result.updated++;
          result.bySource[source]++;
          result.details.push({ id: track.id, name: label, ok: true, source });
        }
      }
    } catch (e) {
      result.failed++;
      result.bySource.failed++;
      result.details.push({
        id: track.id,
        name: label,
        ok: false,
        source: "failed",
        reason: e instanceof Error ? e.message : "error",
      });
    }
    await sleep(150);
  }
  return result;
}

export async function sweepAzuracastAlbums(limit = 50): Promise<RegenerateResult> {
  const { data: rows, error } = await supabaseAdmin
    .from("albums")
    .select("id, title, artwork_path, artist_profiles(name)")
    .ilike("artwork_path", "%/azuracast/%")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as unknown as Array<{
    id: string;
    title: string;
    artwork_path: string | null;
    artist_profiles: { name: string } | null;
  }>;

  const result = emptyResult(list.length);

  for (const album of list) {
    const artistName = album.artist_profiles?.name ?? "";
    const { data: subs } = await supabaseAdmin
      .from("submissions")
      .select("id, title")
      .eq("album_id", album.id);
    const trackRows = (subs ?? []) as Array<{ id: string; title: string }>;
    const trackTitle = trackRows[0]?.title || album.title;
    const label = artistName ? `${artistName} – ${album.title}` : album.title;

    try {
      let path: string | null = null;
      let source: RegenerateSource = "failed";

      if (artistName && trackTitle) {
        const url = await searchTrackImageVerified(artistName, trackTitle);
        if (url) {
          path = await uploadAuto("albums", album.id, url);
          if (path) source = "itunes";
        }
      }
      if (!path && artistName && trackTitle) {
        const url = await searchTrackImageDeezerVerified(artistName, trackTitle);
        if (url) {
          path = await uploadAuto("albums", album.id, url);
          if (path) source = "deezer";
        }
      }
      if (!path && artistName && trackTitle) {
        const url = await searchTrackImageCoverArtArchive(artistName, trackTitle);
        if (url) {
          path = await uploadAuto("albums", album.id, url);
          if (path) source = "musicbrainz";
        }
      }
      if (!path) {
        const ai = await generateTrackFallbackImage(artistName || "Unknown Artist", trackTitle);
        if (ai) {
          path = await uploadBlob("albums", album.id, ai.blob, ai.contentType);
          if (path) source = "ai";
        }
      }

      if (!path) {
        result.failed++;
        result.bySource.failed++;
        result.details.push({ id: album.id, name: label, ok: false, source: "failed", reason: "no-image-produced" });
      } else {
        const { error: upErr } = await supabaseAdmin
          .from("albums")
          .update({ artwork_path: path })
          .eq("id", album.id);
        if (upErr) {
          result.failed++;
          result.bySource.failed++;
          result.details.push({ id: album.id, name: label, ok: false, source: "failed", reason: upErr.message });
        } else {
          if (trackRows.length > 0) {
            await supabaseAdmin
              .from("submissions")
              .update({ artwork_path: path })
              .eq("album_id", album.id);
          }
          result.updated++;
          result.bySource[source]++;
          result.details.push({ id: album.id, name: label, ok: true, source });
        }
      }
    } catch (e) {
      result.failed++;
      result.bySource.failed++;
      result.details.push({
        id: album.id,
        name: label,
        ok: false,
        source: "failed",
        reason: e instanceof Error ? e.message : "error",
      });
    }
    await sleep(200);
  }
  return result;
}