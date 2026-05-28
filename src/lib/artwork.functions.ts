import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  downloadImage,
  searchAlbumImage,
  searchArtistImage,
  searchArtistImageVerified,
  searchArtistImageDeezerVerified,
  searchTrackImageVerified,
  searchTrackImageDeezerVerified,
} from "@/lib/itunes.server";
import { generateArtistFallbackImage, generateTrackFallbackImage } from "@/lib/ai-image.server";

const BUCKET = "artwork";

export type AutoArtworkResult = {
  updated: boolean;
  path: string | null;
  reason?: "no-match" | "already-has-image" | "download-failed" | "not-found";
};

async function uploadAuto(
  folder: "artists" | "albums" | "tracks",
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
  folder: "artists" | "albums" | "tracks",
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

async function fetchArtist(id: string) {
  const { data, error } = await supabaseAdmin
    .from("artist_profiles")
    .select("id, name, avatar_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchAlbum(id: string) {
  const { data, error } = await supabaseAdmin
    .from("albums")
    .select("id, title, artwork_path, artist_profile_id, artist_profiles(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as
    | {
        id: string;
        title: string;
        artwork_path: string | null;
        artist_profile_id: string;
        artist_profiles: { name: string } | null;
      }
    | null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ── Single-item server fns ────────────────────────────────────────────────

export const autoFetchArtistArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ artistId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AutoArtworkResult> => {
    const artist = await fetchArtist(data.artistId);
    if (!artist) return { updated: false, path: null, reason: "not-found" };
    const { data: ownerRow } = await supabaseAdmin
      .from("artist_profiles")
      .select("user_id")
      .eq("id", artist.id)
      .maybeSingle();
    const ownerId = (ownerRow as { user_id: string } | null)?.user_id;
    if (ownerId !== context.userId && !(await isAdmin(context.userId))) {
      throw new Error("Forbidden");
    }
    if (artist.avatar_path) return { updated: false, path: artist.avatar_path, reason: "already-has-image" };

    const url = await searchArtistImage(artist.name);
    if (!url) return { updated: false, path: null, reason: "no-match" };

    const path = await uploadAuto("artists", artist.id, url);
    if (!path) return { updated: false, path: null, reason: "download-failed" };

    const { error } = await supabaseAdmin
      .from("artist_profiles")
      .update({ avatar_path: path })
      .eq("id", artist.id);
    if (error) throw new Error(error.message);
    return { updated: true, path };
  });

export const autoFetchAlbumArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ albumId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AutoArtworkResult> => {
    const album = await fetchAlbum(data.albumId);
    if (!album) return { updated: false, path: null, reason: "not-found" };
    const { data: ownerRow } = await supabaseAdmin
      .from("albums")
      .select("user_id")
      .eq("id", album.id)
      .maybeSingle();
    const ownerId = (ownerRow as { user_id: string } | null)?.user_id;
    if (ownerId !== context.userId && !(await isAdmin(context.userId))) {
      throw new Error("Forbidden");
    }
    if (album.artwork_path) return { updated: false, path: album.artwork_path, reason: "already-has-image" };

    const url = await searchAlbumImage(album.title, album.artist_profiles?.name ?? null);
    if (!url) return { updated: false, path: null, reason: "no-match" };

    const path = await uploadAuto("albums", album.id, url);
    if (!path) return { updated: false, path: null, reason: "download-failed" };

    const { error } = await supabaseAdmin
      .from("albums")
      .update({ artwork_path: path })
      .eq("id", album.id);
    if (error) throw new Error(error.message);
    return { updated: true, path };
  });

// ── Bulk server fns (admin only) ──────────────────────────────────────────

export type BulkResult = {
  scanned: number;
  updated: number;
  missed: number;
  failed: number;
  details: Array<{ id: string; name: string; ok: boolean; reason?: string }>;
};

const BulkInput = z.object({ limit: z.number().int().min(1).max(200).optional() });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const bulkFetchMissingArtistArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BulkInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<BulkResult> => {
    if (!(await isAdmin(context.userId))) throw new Error("Endast admin");
    const limit = data.limit ?? 50;

    const { data: rows, error } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, name")
      .is("avatar_path", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);

    const result: BulkResult = { scanned: rows?.length ?? 0, updated: 0, missed: 0, failed: 0, details: [] };
    for (const r of rows ?? []) {
      try {
        const url = await searchArtistImage(r.name);
        if (!url) {
          result.missed++;
          result.details.push({ id: r.id, name: r.name, ok: false, reason: "no-match" });
        } else {
          const path = await uploadAuto("artists", r.id, url);
          if (!path) {
            result.failed++;
            result.details.push({ id: r.id, name: r.name, ok: false, reason: "download-failed" });
          } else {
            const { error: upErr } = await supabaseAdmin
              .from("artist_profiles")
              .update({ avatar_path: path })
              .eq("id", r.id);
            if (upErr) {
              result.failed++;
              result.details.push({ id: r.id, name: r.name, ok: false, reason: upErr.message });
            } else {
              result.updated++;
              result.details.push({ id: r.id, name: r.name, ok: true });
            }
          }
        }
      } catch (e) {
        result.failed++;
        result.details.push({
          id: r.id,
          name: r.name,
          ok: false,
          reason: e instanceof Error ? e.message : "error",
        });
      }
      await sleep(120);
    }
    return result;
  });

// ── Regenerate track artwork for AzuraCast-imported defaults ──────────────

export const bulkRegenerateTrackArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RegenerateInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<RegenerateResult> => {
    if (!(await isAdmin(context.userId))) throw new Error("Endast admin");
    const limit = data.limit ?? 100;

    const { data: rows, error } = await supabaseAdmin
      .from("submissions")
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

    const result: RegenerateResult = {
      scanned: list.length,
      updated: 0,
      failed: 0,
      bySource: { itunes: 0, deezer: 0, ai: 0, failed: 0 },
      details: [],
    };

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
          result.details.push({
            id: track.id,
            name: label,
            ok: false,
            source: "failed",
            reason: "no-image-produced",
          });
        } else {
          const { error: upErr } = await supabaseAdmin
            .from("submissions")
            .update({ artwork_path: path })
            .eq("id", track.id);
          if (upErr) {
            result.failed++;
            result.bySource.failed++;
            result.details.push({
              id: track.id,
              name: label,
              ok: false,
              source: "failed",
              reason: upErr.message,
            });
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
  });

// ── Regenerate ALL artist artwork (admin only) ────────────────────────────

export type RegenerateSource = "itunes" | "deezer" | "ai" | "failed";

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

const RegenerateInput = z.object({
  limit: z.number().int().min(1).max(500).optional(),
});

export const bulkRegenerateArtistArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RegenerateInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<RegenerateResult> => {
    if (!(await isAdmin(context.userId))) throw new Error("Endast admin");
    const limit = data.limit ?? 100;

    const { data: artists, error } = await supabaseAdmin
      .from("artist_profiles")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);

    const result: RegenerateResult = {
      scanned: artists?.length ?? 0,
      updated: 0,
      failed: 0,
      bySource: { itunes: 0, deezer: 0, ai: 0, failed: 0 },
      details: [],
    };

    for (const artist of artists ?? []) {
      try {
        // Collect this artist's own song titles (approved or any) for verification.
        const { data: subs } = await supabaseAdmin
          .from("submissions")
          .select("title")
          .eq("artist_profile_id", artist.id)
          .limit(20);
        const titles = (subs ?? [])
          .map((s) => s.title)
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

        let path: string | null = null;
        let source: RegenerateSource = "failed";

        // 1. iTunes verified (needs at least one song)
        if (titles.length > 0) {
          const url = await searchArtistImageVerified(artist.name, titles);
          if (url) {
            path = await uploadAuto("artists", artist.id, url);
            if (path) source = "itunes";
          }
        }

        // 2. Deezer verified fallback
        if (!path && titles.length > 0) {
          const url = await searchArtistImageDeezerVerified(artist.name, titles);
          if (url) {
            path = await uploadAuto("artists", artist.id, url);
            if (path) source = "deezer";
          }
        }

        // 3. AI fallback
        if (!path) {
          const ai = await generateArtistFallbackImage(artist.name);
          if (ai) {
            path = await uploadBlob("artists", artist.id, ai.blob, ai.contentType);
            if (path) source = "ai";
          }
        }

        if (!path) {
          result.failed++;
          result.bySource.failed++;
          result.details.push({
            id: artist.id,
            name: artist.name,
            ok: false,
            source: "failed",
            reason: "no-image-produced",
          });
        } else {
          const { error: upErr } = await supabaseAdmin
            .from("artist_profiles")
            .update({ avatar_path: path })
            .eq("id", artist.id);
          if (upErr) {
            result.failed++;
            result.bySource.failed++;
            result.details.push({
              id: artist.id,
              name: artist.name,
              ok: false,
              source: "failed",
              reason: upErr.message,
            });
          } else {
            result.updated++;
            result.bySource[source]++;
            result.details.push({
              id: artist.id,
              name: artist.name,
              ok: true,
              source,
            });
          }
        }
      } catch (e) {
        result.failed++;
        result.bySource.failed++;
        result.details.push({
          id: artist.id,
          name: artist.name,
          ok: false,
          source: "failed",
          reason: e instanceof Error ? e.message : "error",
        });
      }
      await sleep(150);
    }
    return result;
  });

export const bulkFetchMissingAlbumArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BulkInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<BulkResult> => {
    if (!(await isAdmin(context.userId))) throw new Error("Endast admin");
    const limit = data.limit ?? 50;

    const { data: rows, error } = await supabaseAdmin
      .from("albums")
      .select("id, title, artist_profiles(name)")
      .is("artwork_path", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as unknown as Array<{
      id: string;
      title: string;
      artist_profiles: { name: string } | null;
    }>;

    const result: BulkResult = { scanned: list.length, updated: 0, missed: 0, failed: 0, details: [] };
    for (const r of list) {
      const label = r.artist_profiles?.name ? `${r.artist_profiles.name} – ${r.title}` : r.title;
      try {
        const url = await searchAlbumImage(r.title, r.artist_profiles?.name ?? null);
        if (!url) {
          result.missed++;
          result.details.push({ id: r.id, name: label, ok: false, reason: "no-match" });
        } else {
          const path = await uploadAuto("albums", r.id, url);
          if (!path) {
            result.failed++;
            result.details.push({ id: r.id, name: label, ok: false, reason: "download-failed" });
          } else {
            const { error: upErr } = await supabaseAdmin
              .from("albums")
              .update({ artwork_path: path })
              .eq("id", r.id);
            if (upErr) {
              result.failed++;
              result.details.push({ id: r.id, name: label, ok: false, reason: upErr.message });
            } else {
              result.updated++;
              result.details.push({ id: r.id, name: label, ok: true });
            }
          }
        }
      } catch (e) {
        result.failed++;
        result.details.push({
          id: r.id,
          name: label,
          ok: false,
          reason: e instanceof Error ? e.message : "error",
        });
      }
      await sleep(120);
    }
    return result;
  });