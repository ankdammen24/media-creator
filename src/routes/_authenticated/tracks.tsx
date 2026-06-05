import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { useCreatorTracks } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tracks")({ component: TracksPage });

function TracksPage() {
  const tracks = useCreatorTracks();
  return (
    <PageContainer>
      <PageHeader title="Music Catalog" description="Your tracks. All data is fetched live from the Media Rosenqvist API." />
      {tracks.isLoading ? <p className="text-sm text-muted-foreground">Loading tracks…</p> : tracks.error ? <p className="text-sm text-destructive">{tracks.error instanceof Error ? tracks.error.message : "Could not load tracks"}</p> : !tracks.data?.tracks.length ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">You have no tracks yet. <Link to="/upload" className="font-medium text-primary hover:underline">Upload music</Link>.</div> : <div className="divide-y divide-border rounded-xl border border-border bg-card">{tracks.data.tracks.map((track) => <Link key={track.id} to="/tracks/$trackId" params={{ trackId: track.id }} className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50"><div><div className="font-medium">{track.title || "Untitled track"}</div><div className="text-xs text-muted-foreground">{track.isrc ? `ISRC ${track.isrc}` : track.id}</div></div><Badge variant={track.status === "failed" ? "destructive" : "secondary"}>{track.status}</Badge></Link>)}</div>}
    </PageContainer>
  );
}

