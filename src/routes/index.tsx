import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Music2, Mic, UploadCloud, User } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";
import { PlayButton } from "@/components/player/PlayButton";
import type { PlayerTrack } from "@/components/player/PlayerProvider";
import { effectiveArtworkPath } from "@/lib/album-helpers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Media Rosenqvist — Music catalog & podcasts" },
      {
        name: "description",
        content:
          "Browse the Media Rosenqvist catalog, powered by Media Rosenqvist.",
      },
      { property: "og:title", content: "Media Rosenqvist" },
      {
        property: "og:description",
        content: "Music catalog and live radio for Media Rosenqvist.",
      },
    ],
  }),
  component: Index,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

type Row = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  artwork_path: string;
  audio_path: string;
  artist_profiles: { id: string; name: string } | null;
  albums: { artwork_path: string | null } | null;
};

type ArtistRow = {
  id: string;
  name: string;
  avatar_path: string | null;
};

function artworkUrl(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function toTrack(r: Row): PlayerTrack {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist_profiles?.name ?? null,
    artistId: r.artist_profiles?.id ?? null,
    artworkPath: effectiveArtworkPath(r) ?? r.artwork_path,
    audioPath: r.audio_path,
    mediaType: r.media_type,
  };
}

function Index() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Hero />
      <LatestMusic />
      <LatestPodcasts />
      <FeaturedArtists />
    </div>
  );
}

function Hero() {
  const { data, isLoading } = useQuery({
    queryKey: ["home", "hero"],
    queryFn: async (): Promise<Row | null> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, artwork_path, audio_path, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)",
        )
        .eq("status", "approved")
        .eq("media_type", "music")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Row | null;
    },
  });

  if (isLoading) {
    return (
      <section className="mb-14">
        <div className="h-72 animate-pulse rounded-2xl bg-card sm:h-80" />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mb-14 overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
        <span className="inline-block rounded-full border border-border bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Media Rosenqvist
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Music & Podcast Catalog
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Discover approved music and podcasts, or submit your own work for review.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Browse the catalog <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            <UploadCloud className="h-4 w-4" /> Submit media
          </Link>
        </div>
      </section>
    );
  }

  const art = artworkUrl(data.artwork_path);
  const track = toTrack(data);

  return (
    <section className="mb-14">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Blurred backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-2xl"
          style={{ backgroundImage: `url(${art})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/40"
        />

        <div className="relative grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-10">
          <img
            src={art}
            alt={data.title}
            className="h-48 w-48 flex-shrink-0 rounded-xl object-cover shadow-2xl shadow-black/40 sm:h-60 sm:w-60"
          />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Music2 className="h-3 w-3" /> Featured · Music
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              {data.title}
            </h1>
            {data.artist_profiles ? (
              <Link
                to="/artists/$artistId"
                params={{ artistId: data.artist_profiles.id }}
                className="mt-2 inline-block text-base text-muted-foreground transition hover:text-foreground hover:underline"
              >
                {data.artist_profiles.name}
              </Link>
            ) : null}
            {data.description ? (
              <p className="mt-3 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                {data.description}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PlayButton track={track} size="lg" />
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-secondary"
              >
                Browse catalog <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <UploadCloud className="h-4 w-4" /> Submit
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, to }: { title: string; to: "/catalog" }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Link to={to} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        View all →
      </Link>
    </div>
  );
}

function LatestMusic() {
  const { data, isLoading } = useQuery({
    queryKey: ["home", "latest-music"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, artwork_path, audio_path, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)",
        )
        .eq("status", "approved")
        .eq("media_type", "music")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <section className="mb-14">
      <SectionHeader title="Latest music" to="/catalog" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No music yet" description="Approved music will appear here." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((i) => (
            <TrackCard key={i.id} item={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrackCard({ item }: { item: Row }) {
  const track = toTrack(item);
  const art = artworkUrl(item.artwork_path);
  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary/40">
      <div className="relative aspect-square w-full bg-secondary">
        <img src={art} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute bottom-2 right-2 translate-y-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <PlayButton track={track} size="md" variant="overlay" />
        </div>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {item.media_type}
        </div>
        <h3 className="line-clamp-1 text-sm font-semibold">{item.title}</h3>
        {item.artist_profiles ? (
          <Link
            to="/artists/$artistId"
            params={{ artistId: item.artist_profiles.id }}
            className="line-clamp-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {item.artist_profiles.name}
          </Link>
        ) : (
          <p className="line-clamp-1 text-xs text-muted-foreground">Unknown artist</p>
        )}
      </div>
    </article>
  );
}

function LatestPodcasts() {
  const { data, isLoading } = useQuery({
    queryKey: ["home", "latest-podcasts"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, title, description, media_type, artwork_path, audio_path, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)",
        )
        .eq("status", "approved")
        .eq("media_type", "podcast")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="mb-14">
      <SectionHeader title="Latest podcasts" to="/catalog" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data!.map((i) => (
            <PodcastRow key={i.id} item={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function PodcastRow({ item }: { item: Row }) {
  const track = toTrack(item);
  const art = artworkUrl(item.artwork_path);
  return (
    <article className="flex gap-4 overflow-hidden rounded-lg border border-border bg-card p-3 transition hover:border-primary/40">
      <img
        src={art}
        alt={item.title}
        className="h-24 w-24 flex-shrink-0 rounded-md object-cover sm:h-28 sm:w-28"
        loading="lazy"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Mic className="h-3 w-3" /> Podcast
        </div>
        <h3 className="mt-1 line-clamp-1 text-sm font-semibold">{item.title}</h3>
        {item.artist_profiles ? (
          <Link
            to="/artists/$artistId"
            params={{ artistId: item.artist_profiles.id }}
            className="line-clamp-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {item.artist_profiles.name}
          </Link>
        ) : null}
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        ) : null}
        <div className="mt-auto pt-2">
          <PlayButton track={track} size="sm" />
        </div>
      </div>
    </article>
  );
}

function FeaturedArtists() {
  const { data, isLoading } = useQuery({
    queryKey: ["home", "featured-artists"],
    queryFn: async (): Promise<ArtistRow[]> => {
      // Pull recent approved submissions, then dedupe to distinct artist profiles
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "artist_profile_id, created_at, artist_profiles!submissions_artist_profile_id_fkey(id, name, avatar_path)",
        )
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const out: ArtistRow[] = [];
      for (const row of (data ?? []) as unknown as Array<{
        artist_profile_id: string;
        artist_profiles: ArtistRow | null;
      }>) {
        if (!row.artist_profiles) continue;
        if (seen.has(row.artist_profiles.id)) continue;
        seen.add(row.artist_profiles.id);
        out.push(row.artist_profiles);
        if (out.length >= 8) break;
      }
      return out;
    },
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="mb-14">
      <SectionHeader title="Featured artists" to="/catalog" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {data!.map((a) => {
            const avatar = a.avatar_path
              ? supabase.storage.from("artwork").getPublicUrl(a.avatar_path).data.publicUrl
              : null;
            return (
              <Link
                key={a.id}
                to="/artists/$artistId"
                params={{ artistId: a.id }}
                className="group flex flex-col items-center text-center"
              >
                <div className="aspect-square w-full overflow-hidden rounded-full border border-border bg-secondary transition group-hover:border-primary/40">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={a.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <User className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground">{a.name}</p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
