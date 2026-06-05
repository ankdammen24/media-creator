import { createFileRoute, Link } from "@tanstack/react-router";
import { Music } from "lucide-react";
import {
  useCatalogTrack,
  catalogArtistName,
  catalogAlbumTitle,
  catalogArtworkUrl,
  catalogReleaseDate,
} from "@/lib/api-catalog";

export const Route = createFileRoute("/catalog/$trackId")({
  head: ({ params }) => ({
    meta: [
      { title: `Track ${params.trackId} — Crystal Pier Records` },
      {
        name: "description",
        content: "Track details on the Crystal Pier Records public catalog.",
      },
    ],
  }),
  component: CatalogTrackPage,
});

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function CatalogTrackPage() {
  const { trackId } = Route.useParams();
  const q = useCatalogTrack(trackId);
  const track = q.data?.track;
  const art = track ? catalogArtworkUrl(track) : null;
  const preview = track?.previewUrl ?? track?.preview_url ?? null;
  const duration = formatDuration(track?.durationSeconds ?? track?.duration_seconds);
  const release = track ? catalogReleaseDate(track) : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-12">
      <Link
        to="/catalog"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to catalog
      </Link>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading track…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Could not load track"}
        </p>
      ) : !track ? (
        <p className="text-sm text-muted-foreground">Track not found.</p>
      ) : (
        <article className="grid gap-8 md:grid-cols-[320px_1fr]">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
            {art ? (
              <img src={art} alt={`${track.title} artwork`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Music className="h-10 w-10" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{track.title}</h1>
            <p className="mt-1 text-base text-muted-foreground">{catalogArtistName(track)}</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {catalogAlbumTitle(track) && (
                <>
                  <dt className="text-muted-foreground">Album</dt>
                  <dd>{catalogAlbumTitle(track)}</dd>
                </>
              )}
              {release && (
                <>
                  <dt className="text-muted-foreground">Release date</dt>
                  <dd>{release}</dd>
                </>
              )}
              {duration && (
                <>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd>{duration}</dd>
                </>
              )}
              {track.isrc && (
                <>
                  <dt className="text-muted-foreground">ISRC</dt>
                  <dd className="font-mono text-xs">{track.isrc}</dd>
                </>
              )}
              {track.genres && track.genres.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Genres</dt>
                  <dd>{track.genres.join(", ")}</dd>
                </>
              )}
            </dl>

            {preview && (
              <div className="mt-8">
                <h2 className="mb-2 text-sm font-medium">Preview</h2>
                <audio controls src={preview} className="w-full">
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
          </div>
        </article>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        Crystal Pier Records is part of Media Rosenqvist.
      </footer>
    </main>
  );
}
