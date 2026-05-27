import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Music2, Mic } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Soundloom Core" },
      {
        name: "description",
        content: "Browse the Media Rosenqvist catalog: approved music and podcasts.",
      },
      { property: "og:title", content: "Catalog — Soundloom Core" },
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

type Tab = "all" | "music" | "podcast";

type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  media_type: "music" | "podcast";
  artwork_path: string;
  created_at: string;
  artist_profiles: { name: string } | null;
};

async function fetchApproved(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("id, title, description, media_type, artwork_path, created_at, artist_profiles(name)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CatalogItem[];
}

function artworkUrl(path: string) {
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

function CatalogPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["catalog", "approved"],
    queryFn: fetchApproved,
  });

  const items = useMemo(() => {
    let list = data ?? [];
    if (tab !== "all") list = list.filter((i) => i.media_type === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.artist_profiles?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, tab, query]);

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
            placeholder="Search title or artist…"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
        {(["all", "music", "podcast"] as Tab[]).map((t) => (
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

      {isLoading ? (
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
            <article key={i.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-square w-full bg-secondary">
                <img
                  src={artworkUrl(i.artwork_path)}
                  alt={i.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {i.media_type === "music" ? (
                    <Music2 className="h-3 w-3" />
                  ) : (
                    <Mic className="h-3 w-3" />
                  )}
                  {i.media_type}
                </div>
                <h2 className="line-clamp-1 text-sm font-semibold">{i.title}</h2>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {i.artist_profiles?.name ?? "Unknown artist"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}