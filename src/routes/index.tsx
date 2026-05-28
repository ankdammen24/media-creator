import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Music2, Mic, UploadCloud } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { supabase } from "@/integrations/supabase/client";

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

type Item = {
  id: string;
  title: string;
  media_type: "music" | "podcast";
  artwork_path: string;
  artist_profiles: { name: string } | null;
};

function Index() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mb-12">
        <div>
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              <UploadCloud className="h-4 w-4" /> Submit media
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Latest approved</h2>
          <Link
            to="/catalog"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        <Featured />
      </section>
    </div>
  );
}

function Featured() {
  const { data, isLoading } = useQuery({
    queryKey: ["catalog", "featured"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, title, media_type, artwork_path, artist_profiles!submissions_artist_profile_id_fkey(name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing approved yet"
        description="Approved music and podcasts will appear here."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((i) => {
        const url = supabase.storage.from("artwork").getPublicUrl(i.artwork_path).data.publicUrl;
        return (
          <article key={i.id} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-square w-full bg-secondary">
              <img src={url} alt={i.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="space-y-1 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {i.media_type === "music" ? <Music2 className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {i.media_type}
              </div>
              <h3 className="line-clamp-1 text-sm font-semibold">{i.title}</h3>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {i.artist_profiles?.name ?? "Unknown artist"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
