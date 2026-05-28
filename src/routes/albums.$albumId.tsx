import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Disc3,
  Pencil,
  Trash2,
  Music2,
  Play,
  Calendar,
  Tag,
  Loader2,
  Plus,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEditorRole } from "@/lib/useEditorRole";
import { PlayButton } from "@/components/player/PlayButton";
import { usePlayer, type PlayerTrack } from "@/components/player/PlayerProvider";
import {
  ALBUM_TYPE_LABELS,
  type Album,
  albumArtworkUrl,
  nextTrackNumber,
} from "@/lib/album-helpers";
import {
  EditButton,
  EditSubmissionDialog,
  type EditableSubmission,
} from "@/components/SubmissionActions";

export const Route = createFileRoute("/albums/$albumId")({
  head: () => ({
    meta: [
      { title: "Album — Media Rosenqvist" },
      { name: "description", content: "Album details and tracks." },
    ],
  }),
  component: AlbumPage,
});

type Track = {
  id: string;
  title: string;
  track_number: number | null;
  artwork_path: string;
  audio_path: string;
  description: string | null;
  status: string;
  user_id: string;
  media_type: "music" | "podcast";
};

type ArtistMini = { id: string; name: string; avatar_path: string | null } | null;

type AlbumData = {
  album: Album | null;
  artist: ArtistMini;
  tracks: Track[];
};

function publicArt(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function AlbumPage() {
  const { albumId } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useEditorRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["album", albumId, user?.id, isAdmin],
    queryFn: async (): Promise<AlbumData> => {
      const albumRes = await supabase
        .from("albums")
        .select("*")
        .eq("id", albumId)
        .maybeSingle();
      if (albumRes.error) throw albumRes.error;
      const album = (albumRes.data as Album | null) ?? null;
      let artist: ArtistMini = null;
      let tracks: Track[] = [];
      if (album) {
        const [artistRes, tracksRes] = await Promise.all([
          supabase
            .from("artist_profiles")
            .select("id, name, avatar_path")
            .eq("id", album.artist_profile_id)
            .maybeSingle(),
          (() => {
            const isOwner = user?.id === album.user_id;
            let q = supabase
              .from("submissions")
              .select(
                "id, title, track_number, artwork_path, audio_path, description, status, user_id, media_type",
              )
              .eq("album_id", album.id)
              .order("track_number", { ascending: true });
            if (!isOwner && !isAdmin) q = q.eq("status", "approved");
            return q;
          })(),
        ]);
        if (artistRes.error) throw artistRes.error;
        if (tracksRes.error) throw tracksRes.error;
        artist = (artistRes.data as ArtistMini) ?? null;
        tracks = (tracksRes.data ?? []) as Track[];
      }
      return { album, artist, tracks };
    },
  });

  const album = data?.album ?? null;
  const canEdit = !!album && !!user && (user.id === album.user_id || isAdmin);
  const [editingTrack, setEditingTrack] = useState<EditableSubmission | null>(null);

  async function handleDelete() {
    if (!album) return;
    if (!confirm(`Delete album "${album.title}"?`)) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("albums").delete().eq("id", album.id);
    setDeleting(false);
    if (error) {
      setDeleteError(
        error.message.includes("violates foreign key")
          ? "This album still has tracks. Remove them first."
          : error.message,
      );
      return;
    }
    navigate({ to: "/my-submissions" });
  }

  function playAlbum() {
    if (!data || data.tracks.length === 0) return;
    const first = data.tracks[0];
    const track: PlayerTrack = {
      id: first.id,
      title: first.title,
      artist: data.artist?.name ?? null,
      artistId: data.artist?.id ?? null,
      artworkPath: first.artwork_path,
      audioPath: first.audio_path,
      mediaType: "music",
    };
    player.play(track);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        to="/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </Link>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      ) : !album ? (
        <EmptyState title="Album not found" />
      ) : (
        <>
          <header className="mb-8 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-end">
            <div className="h-48 w-48 overflow-hidden rounded-xl border border-border bg-secondary shadow-lg">
              {album.artwork_path ? (
                <img
                  src={publicArt(album.artwork_path)!}
                  alt={album.title}
                  className="h-full w-full object-cover"
                />
              ) : data!.tracks[0]?.artwork_path ? (
                <img
                  src={publicArt(data!.tracks[0].artwork_path)!}
                  alt={album.title}
                  className="h-full w-full object-cover opacity-90"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Disc3 className="h-12 w-12" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Disc3 className="h-3 w-3" /> {ALBUM_TYPE_LABELS[album.album_type]}
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{album.title}</h1>
              {data!.artist && (
                <Link
                  to="/artists/$artistId"
                  params={{ artistId: data!.artist.id }}
                  className="mt-2 inline-block text-base text-muted-foreground hover:text-foreground hover:underline"
                >
                  {data!.artist.name}
                </Link>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {album.release_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(album.release_date).toLocaleDateString()}
                  </span>
                )}
                {album.genre && (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {album.genre}
                  </span>
                )}
                <span>
                  {data!.tracks.length} track{data!.tracks.length === 1 ? "" : "s"}
                </span>
              </div>
              {album.description && (
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{album.description}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={playAlbum}
                  disabled={data!.tracks.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Play className="h-4 w-4" /> Play album
                </button>
                {canEdit && (
                  <>
                    <Link
                      to="/albums/$albumId/edit"
                      params={{ albumId: album.id }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete
                    </button>
                  </>
                )}
              </div>
              {deleteError && (
                <p className="mt-2 text-xs text-destructive">{deleteError}</p>
              )}
            </div>
          </header>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tracks
            </h2>
            {data!.tracks.length === 0 ? (
              <EmptyState
                title="No tracks yet"
                description="Upload music to this album to populate the tracklist."
              />
            ) : (
              <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {data!.tracks.map((t) => {
                  const track: PlayerTrack = {
                    id: t.id,
                    title: t.title,
                    artist: data!.artist?.name ?? null,
                    artistId: data!.artist?.id ?? null,
                    artworkPath: t.artwork_path,
                    audioPath: t.audio_path,
                    mediaType: "music",
                  };
                  const trackCanEdit = !!user && (user.id === t.user_id || isAdmin);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-4 p-3 transition hover:bg-accent/30"
                    >
                      <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
                        {t.track_number ?? "—"}
                      </span>
                      <PlayButton track={track} size="sm" variant="overlay" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        {t.status !== "approved" && (
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t.status.replace("_", " ")}
                          </p>
                        )}
                      </div>
                      {trackCanEdit && (
                        <EditButton
                          onClick={() =>
                            setEditingTrack({
                              id: t.id,
                              title: t.title,
                              description: t.description,
                              media_type: t.media_type,
                              artwork_path: t.artwork_path,
                              audio_path: t.audio_path,
                              status: t.status,
                              user_id: t.user_id,
                              artist_profile_id: album.artist_profile_id,
                              album_id: album.id,
                            })
                          }
                        />
                      )}
                      <Music2 className="hidden h-4 w-4 text-muted-foreground sm:block" />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {canEdit && (
            <AddTracksSection
              album={album}
              onAdded={() =>
                queryClient.invalidateQueries({ queryKey: ["album", albumId, user?.id] })
              }
            />
          )}
          {editingTrack && (
            <EditSubmissionDialog
              sub={editingTrack}
              onClose={() => setEditingTrack(null)}
              onSaved={() => {
                queryClient.invalidateQueries({ queryKey: ["album", albumId] });
                refetch();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

type AvailableTrack = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

function AddTracksSection({
  album,
  onAdded,
}: {
  album: Album;
  onAdded: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["album-available-tracks", album.id, album.artist_profile_id],
    queryFn: async (): Promise<AvailableTrack[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, title, status, created_at")
        .eq("artist_profile_id", album.artist_profile_id)
        .is("album_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AvailableTrack[];
    },
  });

  const available = data ?? [];
  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  async function addSelected() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      let n = await nextTrackNumber(album.id);
      for (const id of selectedIds) {
        const { error } = await supabase
          .from("submissions")
          .update({ album_id: album.id, track_number: n })
          .eq("id", id);
        if (error) throw error;
        n += 1;
      }
      setSelected({});
      await refetch();
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte lägga till");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Lägg till låtar
      </h2>
      <div className="rounded-lg border border-border bg-card p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laddar…</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inga lediga låtar för denna artist. Ladda upp nya, eller koppla loss en låt från ett
            annat album först.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {available.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [t.id]: e.target.checked }))
                    }
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.status.replace("_", " ")} ·{" "}
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={busy || selectedIds.length === 0}
                onClick={addSelected}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Lägg till valda ({selectedIds.length})
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}