import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Music2,
  Mic,
  ArrowLeft,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Pencil,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArtistProfileEditor, type EditableArtist } from "@/components/ArtistProfileEditor";
import { ArtistImageManager, type ArtistImage } from "@/components/ArtistImageManager";

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
  description: string | null;
  created_at: string;
};

type ArtistData = {
  profile: EditableArtist | null;
  items: ArtistItem[];
  images: ArtistImage[];
};

function publicArt(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function ArtistPage() {
  const { artistId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["artist", artistId],
    queryFn: async (): Promise<ArtistData> => {
      const [profileRes, linksRes, imagesRes] = await Promise.all([
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
            "submission_id, submissions!inner(id, title, media_type, artwork_path, audio_path, description, created_at, status)",
          )
          .eq("artist_profile_id", artistId)
          .eq("submissions.status", "approved"),
        supabase
          .from("artist_images")
          .select("*")
          .eq("artist_profile_id", artistId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (linksRes.error) throw linksRes.error;
      if (imagesRes.error) throw imagesRes.error;
      const rows = (linksRes.data ?? []) as unknown as Array<{ submissions: ArtistItem }>;
      const items = rows
        .map((r) => r.submissions)
        .filter(Boolean)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return {
        profile: profileRes.data as EditableArtist | null,
        items,
        images: (imagesRes.data ?? []) as ArtistImage[],
      };
    },
  });

  const profile = data?.profile;
  const canEdit = !!user && !!profile && profile.user_id === user.id;
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
              <ArtistImageManager artistId={profile.id} userId={profile.user_id} />
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
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full bg-secondary">
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
                  <h1 className="text-3xl font-bold tracking-tight">{profile.name}</h1>
                  {canEdit && (
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Redigera profil
                    </button>
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
          {data.items.length === 0 ? (
            <EmptyState
              title="No approved media yet"
              description="Once submissions from this artist are approved they'll appear here."
            />
          ) : (
            <ul className="space-y-3">
              {data.items.map((i) => (
                <ArtistRow key={i.id} item={i} />
              ))}
            </ul>
          )}
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

function ArtistRow({ item }: { item: ArtistItem }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    supabase.storage
      .from("audio")
      .createSignedUrl(item.audio_path, 3600)
      .then(({ data }) => {
        if (on && data) setAudioUrl(data.signedUrl);
      });
    return () => {
      on = false;
    };
  }, [item.audio_path]);

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <img
        src={publicArt(item.artwork_path)}
        alt={item.title}
        className="h-32 w-32 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {item.media_type}
          <span>·</span>
          <span>{new Date(item.created_at).toLocaleDateString()}</span>
        </div>
        <h2 className="truncate text-base font-semibold">{item.title}</h2>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        {audioUrl ? (
          <audio controls preload="none" src={audioUrl} className="mt-3 h-9 w-full max-w-md">
            Your browser does not support audio.
          </audio>
        ) : (
          <div className="mt-3 h-9 w-full max-w-md animate-pulse rounded bg-secondary" />
        )}
      </div>
    </li>
  );
}