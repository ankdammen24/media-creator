import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Music2,
  ArrowLeft,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Pencil,
  Disc3,
  Trash2,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArtistProfileEditor, type EditableArtist } from "@/components/ArtistProfileEditor";
import { ArtistImageManager, type ArtistImage } from "@/components/ArtistImageManager";
import { useEditorRole } from "@/lib/useEditorRole";
import { deleteArtistProfile } from "@/lib/catalog-edit.functions";
import { usePlayer, type PlayerTrack } from "@/components/player/PlayerProvider";
import { ALBUM_TYPE_LABELS, type AlbumType } from "@/lib/album-helpers";
import {
  EditButton,
  EditSubmissionDialog,
  type EditableSubmission,
} from "@/components/SubmissionActions";
import { EditorTrackMeta, EditorAlbumMeta } from "@/components/EditorCardMeta";

export const Route = createFileRoute("/artists/$artistId")({
  head: () => ({
    meta: [
      { title: "Artist — Media Rosenqvist" },
      { name: "description", content: "Approved music and podcasts from this artist." },
    ],
  }),
  component: ArtistPage,
});

type ArtistItem = {
  id: string;
  title: string;
  media_type: "music" | "podcast";
  artwork_path: string;
  audio_path: string;
  audio_web_path: string | null;
  description: string | null;
  created_at: string;
  album_id: string | null;
  user_id: string;
  status: string;
  albums: { artwork_path: string | null } | null;
  isrc: string | null;
  upc: string | null;
  version: string | null;
  track_number: number | null;
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

type AlbumRow = {
  id: string;
  title: string;
  album_type: AlbumType;
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
};

type ArtistData = {
  profile: EditableArtist | null;
  items: ArtistItem[];
  albums: AlbumRow[];
  images: ArtistImage[];
};

function publicArt(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function ArtistPage() {
  const { artistId } = Route.useParams();
  const { user } = useAuth();
  const { isEditor } = useEditorRole();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artist", artistId],
    queryFn: async (): Promise<ArtistData> => {
      const [profileRes, linksRes, imagesRes, albumsRes] = await Promise.all([
        supabase
          .from("artist_profiles")
          .select(
            "id, user_id, name, bio, avatar_path, website_url, facebook_url, instagram_url, x_url, spotify_url, apple_music_url, amazon_music_url",
          )
          .eq("id", artistId)
          .maybeSingle(),
        supabase
          .from("submission_artists")
          .select(
            "submission_id, submissions!inner(id, title, media_type, artwork_path, audio_path, audio_web_path, description, created_at, status, album_id, user_id, isrc, upc, version, track_number, duration_seconds, loudness_lufs, explicit, instrumental, ai_generated, dolby_atmos_available, songwriters, producers, featured_artists, processing_status, albums(artwork_path))",
          )
          .eq("artist_profile_id", artistId)
          .eq("submissions.status", "approved"),
        supabase
          .from("artist_images")
          .select("*")
          .eq("artist_profile_id", artistId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("albums")
          .select("id, title, album_type, artwork_path, release_date, status, upc, label, language, genre, secondary_genre, distribution_platforms, previously_released")
          .eq("artist_profile_id", artistId)
          .order("release_date", { ascending: false, nullsFirst: false }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (linksRes.error) throw linksRes.error;
      if (imagesRes.error) throw imagesRes.error;
      if (albumsRes.error) throw albumsRes.error;
      const rows = (linksRes.data ?? []) as unknown as Array<{ submissions: ArtistItem }>;
      const items = rows
        .map((r) => r.submissions)
        .filter(Boolean)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const rawAlbums = (albumsRes.data ?? []) as Array<Omit<AlbumRow, "trackCount">>;
      const albums: AlbumRow[] = rawAlbums.map((al) => ({
        ...al,
        trackCount: items.filter((i) => i.album_id === al.id).length,
      }));
      return {
        profile: profileRes.data as EditableArtist | null,
        items,
        albums,
        images: (imagesRes.data ?? []) as ArtistImage[],
      };
    },
  });

  const profile = data?.profile;
  const canEdit =
    !!user && !!profile && (profile.user_id === user.id || isEditor);
  const images = data?.images ?? [];
  const primaryCover = images.find((i) => i.kind === "cover" && i.is_primary);
  const primaryAvatar = images.find((i) => i.kind === "avatar" && i.is_primary);
  const pressImages = images.filter((i) => i.kind === "press");
  const avatarSrc = primaryAvatar
    ? publicArt(primaryAvatar.storage_path)
    : profile?.avatar_path
      ? publicArt(profile.avatar_path)
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 sm:px-6">
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
      ) : !profile ? (
        <EmptyState title="Artist not found" />
      ) : (
        <>
          {editing && canEdit ? (
            <div className="mb-8 space-y-6">
              <ArtistProfileEditor
                artist={profile}
                onClose={() => setEditing(false)}
                onSaved={(updated) => {
                  queryClient.setQueryData<ArtistData>(["artist", artistId], (prev) =>
                    prev ? { ...prev, profile: updated } : prev,
                  );
                  setEditing(false);
                }}
              />
              <ArtistImageManager
                artistId={profile.id}
                userId={profile.user_id}
                artistName={profile.name}
              />
            </div>
          ) : (
          <>
            {primaryCover && (
              <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl bg-secondary sm:h-64">
                <img
                  src={publicArt(primaryCover.storage_path)}
                  alt={primaryCover.caption ?? profile.name}
                  className="h-full w-full object-cover"
                />
                {primaryCover.credit && (
                  <span className="absolute bottom-2 right-3 rounded bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
                    Foto: {primaryCover.credit}
                  </span>
                )}
              </div>
            )}
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-secondary sm:h-28 sm:w-28">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted-foreground">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{profile.name}</h1>
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/albums/new"
                        search={{ artistId: profile.id }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                      >
                        <Disc3 className="h-3.5 w-3.5" />
                        Nytt album
                      </Link>
                      <button
                        onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Redigera profil
                      </button>
                    </div>
                  )}
                </div>
                {profile.bio && (
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{profile.bio}</p>
                )}
                <SocialLinks profile={profile} />
              </div>
            </div>
            {pressImages.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Pressbilder
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pressImages.map((img) => (
                    <li
                      key={img.id}
                      className="overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <div className="aspect-square bg-secondary">
                        <img
                          src={publicArt(img.storage_path)}
                          alt={img.caption ?? profile.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {(img.caption || img.credit) && (
                        <div className="space-y-0.5 p-2 text-xs">
                          {img.caption && <p className="truncate">{img.caption}</p>}
                          {img.credit && (
                            <p className="truncate text-muted-foreground">Foto: {img.credit}</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
          )}
          <DiscographySection
            albums={data.albums}
            singles={data.items.filter((i) => !i.album_id)}
            artistName={profile.name}
            artistId={profile.id}
            canEditAny={isEditor}
            currentUserId={user?.id ?? null}
            onRefetch={() => refetch()}
          />
        </>
      )}
    </div>
  );
}

function SocialLinks({ profile }: { profile: EditableArtist }) {
  const links: Array<{ href: string | null; label: string; Icon: typeof Globe }> = [
    { href: profile.website_url, label: "Webbplats", Icon: Globe },
    { href: profile.facebook_url, label: "Facebook", Icon: Facebook },
    { href: profile.instagram_url, label: "Instagram", Icon: Instagram },
    { href: profile.x_url, label: "X", Icon: Twitter },
    { href: profile.spotify_url, label: "Spotify", Icon: Music2 },
    { href: profile.apple_music_url, label: "Apple Music", Icon: Music2 },
    { href: profile.amazon_music_url, label: "Amazon Music", Icon: Music2 },
  ].filter((l) => l.href);
  if (links.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href!}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={l.label}
          title={l.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <l.Icon className="h-3.5 w-3.5" />
          <span>{l.label}</span>
        </a>
      ))}
    </div>
  );
}

function DiscographySection({
  albums,
  singles,
  artistName,
  artistId,
  canEditAny,
  currentUserId,
  onRefetch,
}: {
  albums: AlbumRow[];
  singles: ArtistItem[];
  artistName: string;
  artistId: string;
  canEditAny: boolean;
  currentUserId: string | null;
  onRefetch: () => void;
}) {
  const player = usePlayer();
  const [editing, setEditing] = useState<EditableSubmission | null>(null);
  const singleTracks: PlayerTrack[] = singles.map((s) => ({
    id: s.id,
    title: s.title,
    artist: artistName,
    artistId,
    artworkPath: s.albums?.artwork_path ?? s.artwork_path,
    audioPath: s.audio_path,
    webAudioPath: s.audio_web_path,
    mediaType: s.media_type,
  }));
  if (albums.length === 0 && singles.length === 0) {
    return (
      <EmptyState
        title="Ingen musik ännu"
        description="Skapa ett album eller ladda upp en låt så dyker det upp här."
      />
    );
  }
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Diskografi
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((al) => (
          <li key={al.id}>
            <Link
              to="/albums/$albumId"
              params={{ albumId: al.id }}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                {al.artwork_path ? (
                  <img
                    src={publicArt(al.artwork_path)}
                    alt={al.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Disc3 className="h-10 w-10" />
                  </div>
                )}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  {ALBUM_TYPE_LABELS[al.album_type]}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium">{al.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {al.trackCount} låt{al.trackCount === 1 ? "" : "ar"}
                {al.release_date && (
                  <> · {new Date(al.release_date).getFullYear()}</>
                )}
              </p>
              <EditorAlbumMeta meta={al} />
            </Link>
          </li>
        ))}
        {singles.map((s) => (
          <SingleCard
            key={s.id}
            item={s}
            isCurrent={player.current?.id === s.id}
            onPlay={() => player.playQueue(singleTracks, singles.findIndex((x) => x.id === s.id))}
            canEdit={!!currentUserId && (canEditAny || s.user_id === currentUserId)}
            onEdit={() =>
              setEditing({
                id: s.id,
                title: s.title,
                description: s.description,
                media_type: s.media_type,
                artwork_path: s.artwork_path,
                audio_path: s.audio_path,
                status: s.status,
                user_id: s.user_id,
                artist_profile_id: artistId,
                album_id: s.album_id,
              })
            }
          />
        ))}
      </ul>
      {editing && (
        <EditSubmissionDialog
          sub={editing}
          onClose={() => setEditing(null)}
          onSaved={() => onRefetch()}
        />
      )}
    </section>
  );
}

function SingleCard({
  item,
  isCurrent,
  onPlay,
  canEdit,
  onEdit,
}: {
  item: ArtistItem;
  isCurrent: boolean;
  onPlay: () => void;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <li>
      <div className="group block w-full text-left">
        <div
          role="button"
          tabIndex={0}
          onClick={onPlay}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPlay();
            }
          }}
          className="block w-full cursor-pointer text-left"
        >
          <div
            className={`relative aspect-square overflow-hidden rounded-lg border bg-secondary ${
              isCurrent ? "border-primary ring-2 ring-primary/40" : "border-border"
            }`}
          >
            <img
              src={publicArt(item.albums?.artwork_path ?? item.artwork_path)}
              alt={item.title}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
              <Music2 className="h-3 w-3" /> Single
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }}
                aria-label={`Redigera ${item.title}`}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur hover:bg-accent"
              >
                <Pencil className="h-3 w-3" /> Redigera
              </button>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-medium">{item.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {isCurrent ? "Spelas nu" : "Tryck för att spela"}
          </p>
          <EditorTrackMeta meta={item} />
        </div>
      </div>
    </li>
  );
}