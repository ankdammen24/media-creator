import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ALBUM_IMAGE_ACCEPT,
  ALBUM_IMAGE_EXTS,
  ALBUM_MAX_IMAGE_BYTES,
  ALBUM_TYPE_LABELS,
  type Album,
  type AlbumType,
  albumArtworkUrl,
  extOf,
  sanitizeFilename,
} from "@/lib/album-helpers";

type ArtistOption = { id: string; name: string };

type AlbumFormProps = {
  existing?: Album;
  onSaved?: (album: Album) => void;
  /** Where to navigate after saving when no onSaved is provided. Defaults to the album page. */
  redirectTo?: string;
  /** Lock artist selection to one option (e.g. when launching from /upload). */
  lockArtistId?: string;
};

export function AlbumForm({ existing, onSaved, redirectTo, lockArtistId }: AlbumFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [artistId, setArtistId] = useState<string>(
    existing?.artist_profile_id ?? lockArtistId ?? "",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [releaseDate, setReleaseDate] = useState(existing?.release_date ?? "");
  const [albumType, setAlbumType] = useState<AlbumType>(existing?.album_type ?? "album");
  const [genre, setGenre] = useState(existing?.genre ?? "");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(
    existing ? albumArtworkUrl(existing) : null,
  );
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load artist options
  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) return;
      // Admins can see all artists; everyone else only their own.
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = !!roleData;
      let q = supabase.from("artist_profiles").select("id, name").order("name");
      if (!isAdmin) q = q.eq("user_id", user.id);
      const { data, error } = await q;
      if (!on) return;
      if (error) {
        setError(error.message);
        return;
      }
      const list = (data ?? []) as ArtistOption[];
      setArtists(list);
      if (!artistId && list.length === 1) setArtistId(list[0].id);
    })();
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!artworkFile) return;
    const url = URL.createObjectURL(artworkFile);
    setArtworkPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [artworkFile]);

  function pickArtwork(f: File | null) {
    setArtworkError(null);
    if (!f) {
      setArtworkFile(null);
      setArtworkPreview(existing ? albumArtworkUrl(existing) : null);
      return;
    }
    if (!ALBUM_IMAGE_EXTS.includes(extOf(f.name))) {
      setArtworkError(`Unsupported format. Allowed: ${ALBUM_IMAGE_EXTS.join(", ").toUpperCase()}`);
      return;
    }
    if (f.size > ALBUM_MAX_IMAGE_BYTES) {
      setArtworkError(`Image too large (max 20 MB).`);
      return;
    }
    setArtworkFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !artistId) {
      setError("Titel och artist krävs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let artworkPath: string | null = existing?.artwork_path ?? null;
      if (artworkFile) {
        const path = `${user.id}/album-${Date.now()}-${sanitizeFilename(artworkFile.name)}`;
        const up = await supabase.storage.from("artwork").upload(path, artworkFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: artworkFile.type || undefined,
        });
        if (up.error) throw up.error;
        artworkPath = path;
      }

      const payload = {
        user_id: user.id,
        artist_profile_id: artistId,
        title: title.trim(),
        description: description.trim() || null,
        release_date: releaseDate || null,
        album_type: albumType,
        genre: genre.trim() || null,
        artwork_path: artworkPath,
      };

      let saved: Album;
      if (existing) {
        const { data, error } = await supabase
          .from("albums")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        saved = data as Album;
      } else {
        const { data, error } = await supabase
          .from("albums")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        saved = data as Album;
      }

      if (onSaved) {
        onSaved(saved);
      } else {
        navigate({ to: redirectTo ?? `/albums/${saved.id}` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save album");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          <span className="mb-2 block text-xs font-medium">Album art</span>
          {artworkPreview ? (
            <div className="relative h-40 w-40 overflow-hidden rounded-md border border-border bg-secondary">
              <img
                src={artworkPreview}
                alt="Album art"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => pickArtwork(null)}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80 hover:bg-background"
                aria-label="Remove artwork"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-background text-center text-xs hover:bg-accent/40">
              <ImageIcon className="mb-1 h-5 w-5 text-muted-foreground" />
              Choose album art
              <input
                type="file"
                accept={ALBUM_IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => pickArtwork(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {artworkError && <p className="mt-1 text-xs text-destructive">{artworkError}</p>}
          {artworkPreview && (
            <label className="mt-2 inline-flex cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Replace
              <input
                type="file"
                accept={ALBUM_IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => pickArtwork(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Artist *</label>
            <select
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              disabled={!!lockArtistId || !!existing}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            >
              <option value="">— Select artist —</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {artists.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                You don&rsquo;t have any artist profiles yet. Create one in the upload flow first.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Type</label>
              <select
                value={albumType}
                onChange={(e) => setAlbumType(e.target.value as AlbumType)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(ALBUM_TYPE_LABELS) as AlbumType[]).map((t) => (
                  <option key={t} value={t}>
                    {ALBUM_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Release date</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Genre</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                maxLength={80}
                placeholder="e.g. Indie pop"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim() || !artistId}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {existing ? "Save changes" : "Create album"}
        </button>
      </div>
    </form>
  );
}