import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { creatorQueryKeys, getDistributionStatus } from "@/lib/api-creator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/distribution")({ component: DistributionPage });

function DistributionPage() {
  const distribution = useQuery({ queryKey: creatorQueryKeys.distribution, queryFn: getDistributionStatus });
  const tracks = distribution.data?.tracks ?? [];
  const releases = distribution.data?.releases ?? [];
  return (
    <PageContainer>
      <PageHeader title="Distributionsstatus" description="Backend skapar distributionskopior och avgör publik katalogtillgänglighet. Portalen visar endast status." />
      {distribution.isLoading ? <p className="text-sm text-muted-foreground">Hämtar distribution…</p> : distribution.error ? <p className="text-sm text-destructive">{distribution.error instanceof Error ? distribution.error.message : "Kunde inte hämta distribution"}</p> : <div className="space-y-6"><section className="rounded-xl border border-border bg-card p-5"><h2 className="font-medium">Spår</h2>{tracks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Inga distribuerade spår rapporterade.</p> : <div className="mt-3 divide-y divide-border">{tracks.map((track) => <div key={track.id} className="flex items-center justify-between py-3 text-sm"><span>{track.title || track.id}</span><Badge variant="secondary">{track.status}</Badge></div>)}</div>}</section><section className="rounded-xl border border-border bg-card p-5"><h2 className="font-medium">Releaser</h2>{releases.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Inga releaser rapporterade.</p> : <div className="mt-3 divide-y divide-border">{releases.map((release) => <div key={release.id} className="flex items-center justify-between py-3 text-sm"><span>{release.title || release.id}</span><Badge variant="secondary">{release.status}</Badge></div>)}</div>}</section></div>}
    </PageContainer>
  );
}
