import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Music2, Mic, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { effectiveArtworkPath } from "@/lib/album-helpers";
import { PlayButton } from "@/components/player/PlayButton";
import type { PlayerTrack } from "@/components/player/PlayerProvider";
import { EditorTrackMeta, EditorArtistMeta } from "@/components/EditorCardMeta";

const catalogSearchSchema = z.object({
  focus: fallback(z.string(), "").optional(),
});

export const Route = createFileRoute("/catalog")({
  validateSearch: zodValidator(catalogSearchSchema),
  head: () => ({
    meta: [
      { title: "Catalog — Media Rosenqvist" },
      {
        name: "description",
        content: "Browse the Media Rosenqvist catalog: approved music and podcasts.",
      },
      { property: "og:title", content: "Catalog — Media Rosenqvist" },
      {
        property: "og:description",
        content: "Browse approved music and podcasts in the Media Rosenqvist catalog.",
      },
    ],
  }),
  component: CatalogPage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <EmptyState title="Not found" />
    </div>
  ),
});

type Tab = "all" | "music" | "podcast" | "artists";

type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  artwork_path: string;
  audio_path: string;
  audio_web_path: string | null;
  created_at: string;
  artist_profile_id: string;
  artist_profiles: { id: string; name: string } | null;
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

async function fetchApproved(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, title, description, media_type, artwork_path, audio_path, audio_web_path, created_at, artist_profile_id, isrc, upc, version, track_number, duration_seconds, loudness_lufs, explicit, instrumental, ai_generated, dolby_atmos_available, songwriters, producers, featured_artists, processing_status, artist_profiles!submissions_artist_profile_id_fkey(id, name), albums(artwork_path)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CatalogItem[];
}

type ArtistRow = { id: string; name: string; avatar_path: string | null; approval_status: string | null };

async function fetchArtists(): Promise<ArtistRow[]> {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("id, name, avatar_path, approval_status")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArtistRow[];
}

function artworkUrl(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function CatalogPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [artistId, setArtistId] = useState<string>("all");
  const { focus } = Route.useSearch();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["catalog", "approved"],
    queryFn: fetchApproved,
  });
  const {
    data: artistsAll,
    isLoading: artistsLoading,
    error: artistsError,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["catalog", "artists"],
    queryFn: fetchArtists,
    staleTime: 60_000,
  });

  const artists = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((i) => {
      if (i.artist_profiles) map.set(i.artist_profiles.id, i.artist_profiles.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const items = useMemo(() => {
    let list = data ?? [];
    if (tab !== "all") list = list.filter((i) => i.media_type === tab);
    if (artistId !== "all") list = list.filter((i) => i.artist_profile_id === artistId);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.artist_profiles?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, tab, query, artistId]);

  const focusRef = useRef<HTMLDivElement | null>(null);
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (!focus || !data) return;
    const exists = data.some((i) => i.id === focus);
    if (!exists) return;
    // Reset filters so the focused item is visible
    setTab("all");
    setArtistId("all");
    setQuery("");
    const t = setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);
    }, 50);
    return () => clearTimeout(t);
  }, [focus, data]);

  const filteredArtists = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = artistsAll ?? [];
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [artistsAll, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved music and podcasts from the community.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "artists" ? "Search artist…" : "Search title or artist…"}
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["all", "music", "podcast", "artists"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "artists" && artists.length > 0 && (
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="all">All artists</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "artists" ? (
        artistsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : artistsError ? (
          <ErrorState error={artistsError as Error} onRetry={() => refetchArtists()} />
        ) : filteredArtists.length === 0 ? (
          <EmptyState
            title={query ? "No matches" : "No artists yet"}
            description={query ? "Try a different search term." : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredArtists.map((a) => {
              const avatar = a.avatar_path ? artworkUrl(a.avatar_path) : null;
              return (
                <Link
                  key={a.id}
                  to="/artists/$artistId"
                  params={{ artistId: a.id }}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary"
                >
                  <div className="flex aspect-square w-full items-center justify-center bg-secondary">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={a.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-1 text-sm font-semibold group-hover:text-primary">
                      {a.name}
                    </h2>
                    <EditorArtistMeta meta={a} />
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={query ? "No matches" : "No approved media yet"}
          description={
            query
              ? "Try a different search term."
              : "Once submissions are approved they'll appear here."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((i) => (
            <div
              key={i.id}
              ref={focus === i.id ? focusRef : undefined}
              className={
                focus === i.id && highlight
                  ? "rounded-lg ring-2 ring-primary transition-shadow"
                  : undefined
              }
            >
              <CatalogCard item={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CatalogCard({ item }: { item: CatalogItem }) {
  const track: PlayerTrack = {
    id: item.id,
    title: item.title,
    artist: item.artist_profiles?.name ?? null,
    artistId: item.artist_profiles?.id ?? null,
    artworkPath: effectiveArtworkPath(item) ?? item.artwork_path,
    audioPath: item.audio_path,
    webAudioPath: item.audio_web_path,
    mediaType: item.media_type,
  };

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="group relative aspect-square w-full bg-secondary">
        <img
          src={artworkUrl(effectiveArtworkPath(item) ?? item.artwork_path)}
          alt={item.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30 sm:bg-black/0">
          <div className="opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <PlayButton track={track} size="lg" variant="overlay" />
          </div>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {item.media_type === "music" ? (
            <Music2 className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          {item.media_type}
        </div>
        <h2 className="line-clamp-1 text-sm font-semibold">{item.title}</h2>
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
        <EditorTrackMeta meta={item} />
      </div>
    </article>
  );
}