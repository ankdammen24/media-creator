import { supabase } from "@/integrations/supabase/client";

export type PodcastEpisodeType = "full" | "trailer" | "bonus";

export const EPISODE_TYPE_LABELS: Record<PodcastEpisodeType, string> = {
  full: "Full episode",
  trailer: "Trailer",
  bonus: "Bonus",
};

/** Common Apple/Spotify-style podcast categories (demo subset). */
export const PODCAST_CATEGORIES = [
  "Society & Culture",
  "News",
  "Sports",
  "Comedy",
  "Music",
  "Arts",
  "Business",
  "Technology",
  "Education",
  "Health & Fitness",
  "True Crime",
  "Science",
  "History",
  "Religion & Spirituality",
  "Kids & Family",
  "Leisure",
] as const;

export type PodcastShow = {
  id: string;
  user_id: string;
  artist_profile_id: string;
  title: string;
  description: string | null;
  podcast_category: string | null;
  artwork_path: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
};

/** Next free episode number within a show (1 if empty). */
export async function nextEpisodeNumber(showId: string): Promise<number> {
  const { data, error } = await supabase
    .from("submissions")
    .select("episode_number")
    .eq("album_id", showId)
    .order("episode_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return 1;
  const n = (data?.episode_number ?? 0) as number;
  return n + 1;
}
