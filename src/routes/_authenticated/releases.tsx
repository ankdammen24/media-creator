import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { creatorQueryKeys, listReleases } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/releases")({ component: ReleasesPage });

function ReleasesPage() {
  const releases = useQuery({ queryKey: creatorQueryKeys.releases, queryFn: listReleases });
  return (
    <PageContainer>
      <PageHeader title="Mina releaser" description="Releaser visas som backend rapporterar dem. Portalen hanterar inte granskning eller publicering." />
      {releases.isLoading ? <p className="text-sm text-muted-foreground">Hämtar releaser…</p> : releases.error ? <p className="text-sm text-destructive">{releases.error instanceof Error ? releases.error.message : "Kunde inte hämta releaser"}</p> : !releases.data?.releases.length ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Inga releaser ännu.</div> : <div className="divide-y divide-border rounded-xl border border-border bg-card">{releases.data.releases.map((release) => <Link key={release.id} to="/releases/$releaseId" params={{ releaseId: release.id }} className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50"><div><div className="font-medium">{release.title || "Namnlös release"}</div><div className="text-xs text-muted-foreground">{release.releaseDate ?? release.id}</div></div><Badge variant="secondary">{release.status}</Badge></Link>)}</div>}
    </PageContainer>
  );
}
