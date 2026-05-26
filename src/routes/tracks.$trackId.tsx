import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Music2 } from "lucide-react";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { SourceBadge } from "@/components/SourceBadge";
import { EmptyState, ErrorState } from "@/components/StateViews";
import { trackQuery } from "@/lib/queries";

export const Route = createFileRoute("/tracks/$trackId")({
  head: ({ params }) => ({
    meta: [
      { title: `Track · ${params.trackId} — Soundloom Core` },
      { name: "description", content: "Listen to a track preview from the Media Rosenqvist catalog." },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(trackQuery(params.trackId)),
  component: TrackPage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <EmptyState title="Track not found" />
    </div>
  ),
});

function TrackPage() {
  const { trackId } = Route.useParams();
  const { data: track } = useSuspenseQuery(trackQuery(trackId));
  const art = track.artworkUrl || track.art;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        to="/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </Link>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="aspect-square overflow-hidden rounded-xl border border-border bg-secondary shadow-xl">
          {art ? (
            <img src={art} alt={track.title || ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <SourceBadge source={track.source} />
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {track.title || "Untitled"}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{track.artist || "Unknown artist"}</p>
          {track.album && (
            <p className="mt-1 text-sm text-muted-foreground">From <span className="text-foreground">{track.album}</span></p>
          )}

          <div className="mt-6">
            <PreviewPlayer trackId={track.id} />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Track ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-foreground break-all">{track.id}</dd>
            </div>
            {track.source && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Source</dt>
                <dd className="mt-0.5 text-foreground">{track.source}</dd>
              </div>
            )}
            {track.externalId && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">External ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-foreground break-all">{track.externalId}</dd>
              </div>
            )}
            {typeof track.duration === "number" && track.duration > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Duration</dt>
                <dd className="mt-0.5 text-foreground">
                  {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}