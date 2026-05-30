import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- getAlbumDetails ----------
// Public — returns a single album with artist mini-info and all its tracks.
// Uses the admin client so that the album page mirrors the catalog's
// visibility (which already lists draft albums via getAllAlbums).
const AlbumDetailsInput = z.object({ albumId: z.string().uuid() });

export type AlbumDetailsTrack = {
  id: string;
  title: string;
  track_number: number | null;
  artwork_path: string;
  audio_path: string;
  audio_web_path: string | null;
  description: string | null;
  status: string;
  user_id: string;
  media_type: "music" | "podcast";
  isrc: string | null;
  upc: string | null;
  version: string | null;
  duration_seconds: number | null;
  loudness_lufs: number | null;
  explicit: boolean | null;
  instrumental: boolean | null;
  ai_generated: boolean | null;
  dolby_atmos_available: boolean | null;
  songwriters: string[] | null;
  producers: string[] | null;
  featured_artists: string[] | null;
  processing_status: string | null;
};

export const getAlbumDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => AlbumDetailsInput.parse(input))
  .handler(async ({ data }) => {
    const { data: album, error: albumErr } = await supabaseAdmin
      .from("albums")
      .select(
        "id, user_id, artist_profile_id, title, description, album_type, artwork_path, genre, secondary_genre, language, label, upc, release_date, status, distribution_platforms, previously_released, podcast_category, published_at, submitted_at, created_at, updated_at",
      )
      .eq("id", data.albumId)
      .maybeSingle();
    if (albumErr) throw new Error(`album lookup: ${albumErr.message}`);
    if (!album) return { album: null, artist: null, tracks: [] as AlbumDetailsTrack[] };

    const [artistRes, tracksRes] = await Promise.all([
      supabaseAdmin
        .from("artist_profiles")
        .select("id, name, avatar_path")
        .eq("id", album.artist_profile_id)
        .maybeSingle(),
      supabaseAdmin
        .from("submissions")
        .select(
          "id, title, track_number, artwork_path, audio_path, audio_web_path, description, status, user_id, media_type, isrc, upc, version, duration_seconds, loudness_lufs, explicit, instrumental, ai_generated, dolby_atmos_available, songwriters, producers, featured_artists, processing_status",
        )
        .eq("album_id", album.id)
        .order("track_number", { ascending: true }),
    ]);
    if (artistRes.error) throw new Error(`artist lookup: ${artistRes.error.message}`);
    if (tracksRes.error) throw new Error(`tracks lookup: ${tracksRes.error.message}`);

    return {
      album,
      artist: artistRes.data ?? null,
      tracks: (tracksRes.data ?? []) as AlbumDetailsTrack[],
    };
  });

export type PublicAlbum = {
  id: string;
  title: string;
  album_type: "album" | "ep" | "single" | "compilation";
  artwork_path: string | null;
  release_date: string | null;
  trackCount: number;
  status: string | null;
  upc: string | null;
  label: string | null;
  language: string | null;
  genre: string | null;
  secondary_genre: string | null;
  distribution_platforms: string[] | null;
  previously_released: boolean | null;
  artist_profile_id: string;
  artist_name: string;
  artist_avatar_path: string | null;
};

// ---------- getAllAlbums ----------
// Public — returns every album with artist name / avatar and track count.
export const getAllAlbums = createServerFn({ method: "POST" })
  .inputValidator((input: { artistProfileId?: string }) => input)
  .handler(async ({ data }): Promise<PublicAlbum[]> => {
    let q = supabaseAdmin
      .from("albums")
      .select(
        "id, title, album_type, artwork_path, release_date, status, upc, label, language, genre, secondary_genre, distribution_platforms, previously_released, artist_profile_id, artist_profiles!inner(name, avatar_path)",
      )
      .order("release_date", { ascending: false, nullsFirst: false });

    if (data.artistProfileId) {
      q = q.eq("artist_profile_id", data.artistProfileId);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(`albums lookup: ${error.message}`);

    const albums = (rows ?? []) as Array<{
      id: string;
      title: string;
      album_type: "album" | "ep" | "single" | "compilation";
      artwork_path: string | null;
      release_date: string | null;
      status: string | null;
      upc: string | null;
      label: string | null;
      language: string | null;
      genre: string | null;
      secondary_genre: string | null;
      distribution_platforms: string[] | null;
      previously_released: boolean | null;
      artist_profile_id: string;
      artist_profiles: { name: string; avatar_path: string | null } | { name: string; avatar_path: string | null }[] | null;
    }>;

    if (albums.length === 0) return [];

    // Pull track counts
    const albumIds = albums.map((a) => a.id);
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("submissions")
      .select("album_id")
      .in("album_id", albumIds);
    if (subsErr) throw new Error(`submissions lookup: ${subsErr.message}`);

    const counts = new Map<string, number>();
    for (const s of (subs ?? []) as Array<{ album_id: string }>) {
      counts.set(s.album_id, (counts.get(s.album_id) ?? 0) + 1);
    }

    return albums.map((al) => {
      const artist = Array.isArray(al.artist_profiles)
        ? al.artist_profiles[0]
        : al.artist_profiles;
      return {
        id: al.id,
        title: al.title,
        album_type: al.album_type,
        artwork_path: al.artwork_path,
        release_date: al.release_date,
        trackCount: counts.get(al.id) ?? 0,
        status: al.status,
        upc: al.upc,
        label: al.label,
        language: al.language,
        genre: al.genre,
        secondary_genre: al.secondary_genre,
        distribution_platforms: al.distribution_platforms,
        previously_released: al.previously_released,
        artist_profile_id: al.artist_profile_id,
        artist_name: artist?.name ?? "",
        artist_avatar_path: artist?.avatar_path ?? null,
      };
    });
  });

// ---------- getArtistAlbums ----------
// Public — albums for a single artist with track count.
const ArtistAlbumsInput = z.object({
  artistProfileId: z.string().uuid(),
});

export const getArtistAlbums = createServerFn({ method: "POST" })
  .inputValidator((input) => ArtistAlbumsInput.parse(input))
  .handler(async ({ data }): Promise<PublicAlbum[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("albums")
      .select(
        "id, title, album_type, artwork_path, release_date, status, upc, label, language, genre, secondary_genre, distribution_platforms, previously_released, artist_profile_id, artist_profiles!inner(name, avatar_path)",
      )
      .eq("artist_profile_id", data.artistProfileId)
      .order("release_date", { ascending: false, nullsFirst: false });

    if (error) throw new Error(`albums lookup: ${error.message}`);

    const albums = (rows ?? []) as Array<{
      id: string;
      title: string;
      album_type: "album" | "ep" | "single" | "compilation";
      artwork_path: string | null;
      release_date: string | null;
      status: string | null;
      upc: string | null;
      label: string | null;
      language: string | null;
      genre: string | null;
      secondary_genre: string | null;
      distribution_platforms: string[] | null;
      previously_released: boolean | null;
      artist_profile_id: string;
      artist_profiles: { name: string; avatar_path: string | null } | { name: string; avatar_path: string | null }[] | null;
    }>;

    if (albums.length === 0) return [];

    const albumIds = albums.map((a) => a.id);
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from("submissions")
      .select("album_id")
      .in("album_id", albumIds);
    if (subsErr) throw new Error(`submissions lookup: ${subsErr.message}`);

    const counts = new Map<string, number>();
    for (const s of (subs ?? []) as Array<{ album_id: string }>) {
      counts.set(s.album_id, (counts.get(s.album_id) ?? 0) + 1);
    }

    return albums.map((al) => {
      const artist = Array.isArray(al.artist_profiles)
        ? al.artist_profiles[0]
        : al.artist_profiles;
      return {
        id: al.id,
        title: al.title,
        album_type: al.album_type,
        artwork_path: al.artwork_path,
        release_date: al.release_date,
        trackCount: counts.get(al.id) ?? 0,
        status: al.status,
        upc: al.upc,
        label: al.label,
        language: al.language,
        genre: al.genre,
        secondary_genre: al.secondary_genre,
        distribution_platforms: al.distribution_platforms,
        previously_released: al.previously_released,
        artist_profile_id: al.artist_profile_id,
        artist_name: artist?.name ?? "",
        artist_avatar_path: artist?.avatar_path ?? null,
      };
    });
  });
