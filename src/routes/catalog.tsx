import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Music2 } from "lucide-react";
import { TrackCard } from "@/components/TrackCard";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { artistsQuery, releasesQuery, tracksQuery } from "@/lib/queries";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Soundloom Core" },
      {
        name: "description",
        content: "Browse the Media Rosenqvist music catalog: tracks, releases and artists.",
      },
      { property: "og:title", content: "Catalog — Soundloom Core" },
      {
        property: "og:description",
        content: "Browse tracks, releases and artists in the Media Rosenqvist catalog.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tracksQuery());
    context.queryClient.ensureQueryData(artistsQuery());
    context.queryClient.ensureQueryData(releasesQuery());
  },
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

type Tab = "tracks" | "releases" | "artists";

function CatalogPage() {
  const [tab, setTab] = useState<Tab>("tracks");
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The complete Media Rosenqvist library.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or artist…"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        {(["tracks", "releases", "artists"] as Tab[]).map((t) => (
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

      {tab === "tracks" && <TracksPanel query={query} />}
      {tab === "releases" && <ReleasesPanel query={query} />}
      {tab === "artists" && <ArtistsPanel query={query} />}
    </div>
  );
}

function TracksPanel({ query }: { query: string }) {
  const { data } = useSuspenseQuery(tracksQuery());
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.artist || "").toLowerCase().includes(q),
    );
  }, [data.items, query]);

  if (items.length === 0) {
    return (
      <EmptyState
        title={query ? "No matches" : "No tracks yet"}
        description={
          query
            ? "Try a different search term."
            : "The Media Rosenqvist catalog is currently empty. Check back soon."
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((t) => (
        <TrackCard key={t.id} track={t} />
      ))}
    </div>
  );
}

function ReleasesPanel({ query }: { query: string }) {
  const { data } = useSuspenseQuery(releasesQuery());
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (r) =>
        (r.title || "").toLowerCase().includes(q) ||
        (r.artist || "").toLowerCase().includes(q),
    );
  }, [data.items, query]);

  if (items.length === 0) {
    return (
      <EmptyState
        title={query ? "No matches" : "No releases yet"}
        description="Releases will appear here once added to the catalog."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="aspect-square w-full bg-secondary">
            {r.artworkUrl ? (
              <img src={r.artworkUrl} alt={r.title || ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music2 className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-1 p-3">
            <h3 className="line-clamp-1 text-sm font-semibold">{r.title || "Untitled"}</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {r.artist || "Unknown artist"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtistsPanel({ query }: { query: string }) {
  const { data } = useSuspenseQuery(artistsQuery());
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((a) => (a.name || "").toLowerCase().includes(q));
  }, [data.items, query]);

  if (items.length === 0) {
    return (
      <EmptyState
        title={query ? "No matches" : "No artists yet"}
        description="Artists will appear here once added to the catalog."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((a) => (
        <div key={a.id} className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full bg-secondary">
            {a.imageUrl ? (
              <img src={a.imageUrl} alt={a.name || ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <h3 className="line-clamp-1 text-sm font-semibold">{a.name || "Unknown"}</h3>
        </div>
      ))}
    </div>
  );
}