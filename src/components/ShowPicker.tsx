import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Mic, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PODCAST_CATEGORIES, type PodcastShow } from "@/lib/podcast-helpers";

type Props = {
  artistId: string | null;
  value: string;
  onChange: (showId: string) => void;
  disabled?: boolean;
};

/**
 * Dropdown listing the user's podcast shows for a chosen artist + inline
 * "create new show" form so the user never leaves the upload flow.
 * A "show" is stored as an album with album_type = 'podcast_show'.
 */
export function ShowPicker({ artistId, value, onChange, disabled }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>(PODCAST_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: shows = [], isLoading } = useQuery({
    queryKey: ["shows-for-artist", artistId, user?.id],
    enabled: !!artistId && !!user,
    queryFn: async (): Promise<PodcastShow[]> => {
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_profile_id", artistId!)
        .eq("album_type", "podcast_show")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PodcastShow[];
    },
  });

  // Reset value if it doesn't belong to the current artist's shows
  useEffect(() => {
    if (value && shows.length > 0 && !shows.find((s) => s.id === value)) {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shows, value]);

  async function createInline() {
    if (!user || !artistId || !newTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("albums")
        .insert({
          user_id: user.id,
          artist_profile_id: artistId,
          title: newTitle.trim(),
          album_type: "podcast_show",
          podcast_category: newCategory,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      const created = data as unknown as PodcastShow;
      await qc.invalidateQueries({ queryKey: ["shows-for-artist", artistId, user.id] });
      onChange(created.id);
      setCreating(false);
      setNewTitle("");
      setNewCategory(PODCAST_CATEGORIES[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create show");
    } finally {
      setBusy(false);
    }
  }

  if (!artistId) {
    return (
      <p className="text-xs text-muted-foreground">
        Choose a profile first to pick a show.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!creating && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isLoading}
            className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          >
            <option value="">
              {isLoading ? "Loading…" : shows.length === 0 ? "— No shows yet —" : "— Select show —"}
            </option>
            {shows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.podcast_category ? ` · ${s.podcast_category}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs hover:bg-accent/40 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> New show
          </button>
        </div>
      )}

      {creating && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <Mic className="h-3.5 w-3.5 text-primary" /> Quick-create show
            </span>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={200}
              placeholder="Show title"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {PODCAST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createInline}
              disabled={busy || !newTitle.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Add cover art, description and language later on the show page.
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
