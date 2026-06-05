import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { creatorQueryKeys, getRelease } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/releases/$releaseId")({ component: ReleaseDetailPage });

function ReleaseDetailPage() {
  const { releaseId } = Route.useParams();
  const release = useQuery({ queryKey: creatorQueryKeys.release(releaseId), queryFn: () => getRelease(releaseId) });
  const data = release.data;
  return (
    <PageContainer>
      <PageHeader title={data?.release.title || "Releasedetaljer"} description="Detaljer hämtas från backend. Slutlig status bestäms inte i portalen." actions={data?.release.status ? <Badge variant="secondary">{data.release.status}</Badge> : undefined} />
      {release.isLoading ? <p className="text-sm text-muted-foreground">Hämtar release…</p> : release.error ? <p className="text-sm text-destructive">{release.error instanceof Error ? release.error.message : "Kunde inte hämta release"}</p> : data ? <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="rounded-xl border border-border bg-card p-6"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Info label="ID" value={data.release.id} /><Info label="Typ" value={data.release.releaseType ?? "—"} /><Info label="Releasedatum" value={data.release.releaseDate ?? "—"} /><Info label="Status" value={String(data.release.status)} /></dl></section><aside className="rounded-xl border border-border bg-card p-5"><h2 className="font-medium">Spår</h2><div className="mt-3 space-y-2 text-sm">{(data.tracks ?? []).length === 0 ? <p className="text-muted-foreground">Inga spår rapporterade.</p> : data.tracks?.map((track) => <Link key={track.id} to="/tracks/$trackId" params={{ trackId: track.id }} className="block rounded-md border border-border p-3 hover:bg-secondary/50">{track.title || track.id}</Link>)}</div></aside></div> : null}
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}
