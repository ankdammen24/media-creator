import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ArtistNameRow = { id: string; name: string };

/**
 * Loads ALL artist names (RLS allows everyone to read artist_profiles).
 * Used to prevent duplicate artist creation during submissions.
 */
export function useAllArtistNames() {
  const [names, setNames] = useState<ArtistNameRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await supabase
        .from("artist_profiles")
        .select("id, name")
        .order("name");
      if (!on) return;
      setNames((data ?? []) as ArtistNameRow[]);
      setLoading(false);
    })();
    return () => {
      on = false;
    };
  }, []);

  function findDuplicate(name: string): ArtistNameRow | null {
    const norm = name.trim().toLowerCase();
    if (!norm) return null;
    return names.find((n) => n.name.trim().toLowerCase() === norm) ?? null;
  }

  return { names, loading, findDuplicate };
}