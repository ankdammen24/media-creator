// Public-safe projections for catalog data

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";

export function artworkUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/artwork/${path}`;
}

export type PublicTrack = {
  id: string;
  title: string;
  artist_id: string;
  album_id: string | null;
  isrc: string | null;
  duration_seconds: number | null;
  explicit: boolean;
  media_type: string;
  track_number: number | null;
  season_number: number | null;
  episode_number: number | null;
  artwork_url: string | null;
  approved_at: string | null;
};

export function projectTrack(row: Record<string, unknown>): PublicTrack {
  return {
    id: row.id as string,
    title: row.title as string,
    artist_id: row.artist_profile_id as string,
    album_id: (row.album_id as string | null) ?? null,
    isrc: (row.isrc as string | null) ?? null,
    duration_seconds: (row.duration_seconds as number | null) ?? null,
    explicit: Boolean(row.explicit),
    media_type: row.media_type as string,
    track_number: (row.track_number as number | null) ?? null,
    season_number: (row.season_number as number | null) ?? null,
    episode_number: (row.episode_number as number | null) ?? null,
    artwork_url: artworkUrl(row.artwork_path as string | null),
    approved_at: (row.approved_at as string | null) ?? null,
  };
}

export type PublicArtist = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  amazon_music_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  x_url: string | null;
  created_at: string;
};

export function projectArtist(row: Record<string, unknown>): PublicArtist {
  return {
    id: row.id as string,
    name: row.name as string,
    bio: (row.bio as string | null) ?? null,
    avatar_url: artworkUrl(row.avatar_path as string | null),
    website_url: (row.website_url as string | null) ?? null,
    spotify_url: (row.spotify_url as string | null) ?? null,
    apple_music_url: (row.apple_music_url as string | null) ?? null,
    amazon_music_url: (row.amazon_music_url as string | null) ?? null,
    facebook_url: (row.facebook_url as string | null) ?? null,
    instagram_url: (row.instagram_url as string | null) ?? null,
    x_url: (row.x_url as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export type PublicAlbum = {
  id: string;
  title: string;
  artist_id: string;
  album_type: string;
  release_date: string | null;
  upc: string | null;
  genre: string | null;
  secondary_genre: string | null;
  language: string | null;
  artwork_url: string | null;
  label: string | null;
  description: string | null;
  published_at: string | null;
};

export function projectAlbum(row: Record<string, unknown>): PublicAlbum {
  return {
    id: row.id as string,
    title: row.title as string,
    artist_id: row.artist_profile_id as string,
    album_type: row.album_type as string,
    release_date: (row.release_date as string | null) ?? null,
    upc: (row.upc as string | null) ?? null,
    genre: (row.genre as string | null) ?? null,
    secondary_genre: (row.secondary_genre as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    artwork_url: artworkUrl(row.artwork_path as string | null),
    label: (row.label as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
  };
}

export const PUBLIC_TRACK_COLUMNS =
  "id, title, artist_profile_id, album_id, isrc, duration_seconds, explicit, media_type, track_number, season_number, episode_number, artwork_path, approved_at";

export const PUBLIC_ARTIST_COLUMNS =
  "id, name, bio, avatar_path, website_url, spotify_url, apple_music_url, amazon_music_url, facebook_url, instagram_url, x_url, created_at";

export const PUBLIC_ALBUM_COLUMNS =
  "id, title, artist_profile_id, album_type, release_date, upc, genre, secondary_genre, language, artwork_path, label, description, published_at";

export function parsePagination(url: URL): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  return { limit, offset };
}
