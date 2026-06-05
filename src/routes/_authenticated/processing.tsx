import { createFileRoute, Link } from "@tanstack/react-router";
import { useCreatorTracks, useTrackStatus } from "@/lib/api-creator";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/processing")({
  validateSearch: (search) => ({ trackIds: typeof search.trackIds === "string" ? search.trackIds : undefined }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const { trackIds } = Route.useSearch();
  const highlightedIds = trackIds?.split(",").filter(Boolean) ?? [];
  const tracks = useCreatorTracks();
  const processingTracks = (tracks.data?.tracks ?? []).filter((track) => highlightedIds.includes(track.id) || ["uploading", "uploaded", "processing", "processed", "failed"].includes(track.status));

  return (
    <PageContainer>
      <PageHeader title="Bearbetningsstatus" description="Status hämtas från backend var tredje sekund för aktiva spår. Frontend gör ingen ljudbearbetning." />
      {highlightedIds.length > 0 ? <div className="mb-5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Nya uppladdningar: {highlightedIds.length} spår. Du kan lämna sidan; backend fortsätter jobbet.</div> : null}
      {tracks.isLoading ? <p className="text-sm text-muted-foreground">Hämtar status…</p> : processingTracks.length === 0 ? <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Inga aktiva bearbetningar just nu.</p> : <div className="space-y-3">{processingTracks.map((track) => <ProcessingCard key={track.id} trackId={track.id} fallbackTitle={track.title ?? "Namnlöst spår"} />)}</div>}
    </PageContainer>
  );
}

function ProcessingCard({ trackId, fallbackTitle }: { trackId: string; fallbackTitle: string }) {
  const status = useTrackStatus(trackId);
  const track = status.data?.track;
  const jobs = status.data?.processingJobs ?? status.data?.processing_jobs ?? [];
  const latestJob = jobs[0];
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/tracks/$trackId" params={{ trackId }} className="font-medium hover:underline">{track?.title || fallbackTitle}</Link>
          <p className="mt-1 text-xs text-muted-foreground">{trackId}</p>
        </div>
        <Badge variant={track?.status === "failed" ? "destructive" : "secondary"}>{track?.status ?? "hämtar"}</Badge>
      </div>
      {latestJob ? <p className="mt-3 text-sm text-muted-foreground">Jobbstatus: {latestJob.status}{latestJob.error_message || latestJob.errorMessage ? ` · ${latestJob.error_message ?? latestJob.errorMessage}` : ""}</p> : <p className="mt-3 text-sm text-muted-foreground">Väntar på jobbstatus från API:t.</p>}
      {track?.status === "processed" ? <Link to="/tracks/$trackId" params={{ trackId }} className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">Fortsätt till metadata</Link> : null}
    </section>
  );
}
