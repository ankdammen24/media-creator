import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Music, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useCatalogTracks,
  catalogArtistName,
  catalogAlbumTitle,
  catalogArtworkUrl,
} from "@/lib/api-catalog";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Music Catalog — Crystal Pier Records" },
      {
        name: "description",
        content:
          "Browse releases distributed by Crystal Pier Records, part of Media Rosenqvist.",
      },
      { property: "og:title", content: "Music Catalog — Crystal Pier Records" },
      {
        property: "og:description",
        content:
          "Browse releases distributed by Crystal Pier Records, part of Media Rosenqvist.",
      },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const tracks = useCatalogTracks();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const all = tracks.data?.tracks ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((t) => {
      const hay = [t.title, catalogArtistName(t), catalogAlbumTitle(t) ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [tracks.data, q]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Music Catalog</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Releases distributed by Crystal Pier Records, part of Media Rosenqvist.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, artists, albums…"
            className="pl-9"
          />
        </div>
      </header>

      {tracks.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      ) : tracks.error ? (
        <p className="text-sm text-destructive">
          {tracks.error instanceof Error ? tracks.error.message : "Could not load catalog"}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {q ? "No tracks match your search." : "No tracks in the catalog yet."}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((track) => {
            const art = catalogArtworkUrl(track);
            return (
              <li key={track.id}>
                <Link
                  to="/catalog/$trackId"
                  params={{ trackId: track.id }}
                  className="group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="aspect-square w-full bg-muted">
                    {art ? (
                      <img
                        src={art}
                        alt={`${track.title} artwork`}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Music className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-medium">{track.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {catalogArtistName(track)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        Crystal Pier Records is part of Media Rosenqvist.
      </footer>
    </main>
  );
}
