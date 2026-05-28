import { supabase } from "@/integrations/supabase/client";

export type AlbumType = "album" | "ep" | "single" | "compilation";

export const ALBUM_TYPE_LABELS: Record<AlbumType, string> = {
  album: "Album",
  ep: "EP",
  single: "Single",
  compilation: "Compilation",
};

export type Album = {
  id: string;
  user_id: string;
  artist_profile_id: string;
  title: string;
  description: string | null;
  release_date: string | null;
  album_type: AlbumType;
  genre: string | null;
  artwork_path: string | null;
  created_at: string;
  updated_at: string;
};

export function albumArtworkUrl(album: { artwork_path: string | null }): string | null {
  if (!album.artwork_path) return null;
  return supabase.storage.from("artwork").getPublicUrl(album.artwork_path).data.publicUrl;
}

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export const ALBUM_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
export const ALBUM_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const ALBUM_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Next free track number in an album (1 if empty). */
export async function nextTrackNumber(albumId: string): Promise<number> {
  const { data, error } = await supabase
    .from("submissions")
    .select("track_number")
    .eq("album_id", albumId)
    .order("track_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return 1;
  const n = (data?.track_number ?? 0) as number;
  return n + 1;
}