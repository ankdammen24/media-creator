import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Disc3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ALBUM_TYPE_LABELS, type Album, type AlbumType } from "@/lib/album-helpers";

type Props = {
  artistId: string | null;
  value: string;
  onChange: (albumId: string) => void;
  disabled?: boolean;
};

/**
 * Dropdown listing the user's albums for a chosen artist + inline
 * "create new album" form so the user never leaves the upload flow.
 */
export function AlbumPicker({ artistId, value, onChange, disabled }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<AlbumType>("single");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["albums-for-artist", artistId, user?.id],
    enabled: !!artistId && !!user,
    queryFn: async (): Promise<Album[]> => {
      const { data, error } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_profile_id", artistId!)
        .neq("album_type", "podcast_show")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Album[];
    },
  });

  // Reset value if it doesn't belong to the current artist's albums
  useEffect(() => {
    if (value && albums.length > 0 && !albums.find((a) => a.id === value)) {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albums, value]);

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
          album_type: newType,
        })
        .select("*")
        .single();
      if (error) throw error;
      const created = data as Album;
      await qc.invalidateQueries({ queryKey: ["albums-for-artist", artistId, user.id] });
      onChange(created.id);
      setCreating(false);
      setNewTitle("");
      setNewType("single");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create album");
    } finally {
      setBusy(false);
    }
  }

  if (!artistId) {
    return (
      <p className="text-xs text-muted-foreground">
        Choose an artist first to pick an album.
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
              {isLoading ? "Loading…" : albums.length === 0 ? "— No albums yet —" : "— Select album —"}
            </option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · {ALBUM_TYPE_LABELS[a.album_type]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs hover:bg-accent/40 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> New album
          </button>
        </div>
      )}

      {creating && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <Disc3 className="h-3.5 w-3.5 text-primary" /> Quick-create album
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
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={200}
              placeholder="Album title"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as AlbumType)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(ALBUM_TYPE_LABELS) as AlbumType[]).map((t) => (
                <option key={t} value={t}>
                  {ALBUM_TYPE_LABELS[t]}
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
            Add album art, description and release date later on the album page.
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}