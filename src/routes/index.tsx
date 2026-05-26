import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { NowPlaying } from "@/components/NowPlaying";
import { TrackCard } from "@/components/TrackCard";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { tracksQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Soundloom Core — Music catalog & live radio" },
      {
        name: "description",
        content:
          "Browse the Media Rosenqvist catalog and listen to Radio Uppsala live, powered by Soundloom Core.",
      },
      { property: "og:title", content: "Soundloom Core" },
      {
        property: "og:description",
        content: "Music catalog and live radio for Media Rosenqvist.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(tracksQuery());
  },
  component: Index,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
});

function Index() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mb-12 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Soundloom Core
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Media Rosenqvist's <span className="text-primary">music catalog</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Explore tracks, releases and artists from the Media Rosenqvist library,
            and tune in to Radio Uppsala in real time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <NowPlaying />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Featured tracks</h2>
          <Link
            to="/catalog"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </div>
        <FeaturedTracks />
      </section>
    </div>
  );
}

function FeaturedTracks() {
  const { data } = useSuspenseQuery(tracksQuery());
  const items = data.items.slice(0, 8);
  if (items.length === 0) {
    return (
      <EmptyState
        title="No tracks in the catalog yet"
        description="When tracks are added to the Media Rosenqvist catalog, they'll appear here."
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
