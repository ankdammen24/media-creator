import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { useCreatorTracks } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tracks")({ component: TracksPage });

function TracksPage() {
  const tracks = useCreatorTracks();
  return (
    <PageContainer>
      <PageHeader title="Mina spår" description="Alla spår hämtas från externa API:t. Portalen sparar ingen metadata i Supabase." />
      {tracks.isLoading ? <p className="text-sm text-muted-foreground">Hämtar spår…</p> : tracks.error ? <p className="text-sm text-destructive">{tracks.error instanceof Error ? tracks.error.message : "Kunde inte hämta spår"}</p> : !tracks.data?.tracks.length ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Du har inga spår ännu. <Link to="/upload" className="font-medium text-primary hover:underline">Ladda upp musik</Link>.</div> : <div className="divide-y divide-border rounded-xl border border-border bg-card">{tracks.data.tracks.map((track) => <Link key={track.id} to="/tracks/$trackId" params={{ trackId: track.id }} className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50"><div><div className="font-medium">{track.title || "Namnlöst spår"}</div><div className="text-xs text-muted-foreground">{track.isrc ? `ISRC ${track.isrc}` : track.id}</div></div><Badge variant={track.status === "failed" ? "destructive" : "secondary"}>{track.status}</Badge></Link>)}</div>}
    </PageContainer>
  );
}
