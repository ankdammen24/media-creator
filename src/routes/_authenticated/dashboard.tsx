import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Music, Upload, type LucideIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { getDashboard, listTracks, creatorQueryKeys } from "@/lib/api-creator";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const dashboard = useQuery({ queryKey: creatorQueryKeys.dashboard, queryFn: getDashboard });
  const tracks = useQuery({ queryKey: creatorQueryKeys.tracks, queryFn: listTracks });
  const allTracks = dashboard.data?.tracks ?? tracks.data?.tracks ?? [];
  const processing = allTracks.filter((track) => ["uploading", "uploaded", "processing"].includes(track.status)).length;
  const ready = allTracks.filter((track) => track.status === "processed").length;

  return (
    <PageContainer>
      <PageHeader title="Översikt" description="En tunn skaparyta ovanpå Media Rosenqvist API." actions={<Link to="/upload" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ladda upp musik</Link>} />
      <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t("sourceOfTruth")}</div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={Music} label="Spår" value={allTracks.length} />
        <Metric icon={Activity} label="Bearbetas" value={processing} />
        <Metric icon={Upload} label="Klara för metadata" value={ready} />
      </div>
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Senaste spår</h2>
        {tracks.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Hämtar spår…</p> : allTracks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Inga spår ännu. Börja med en uppladdning.</p> : <div className="mt-3 divide-y divide-border">{allTracks.slice(0, 5).map((track) => <Link key={track.id} to="/tracks/$trackId" params={{ trackId: track.id }} className="flex items-center justify-between py-3 text-sm hover:text-primary"><span>{track.title || "Namnlöst spår"}</span><span className="text-xs uppercase text-muted-foreground">{track.status}</span></Link>)}</div>}
      </section>
    </PageContainer>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-card p-5"><Icon className="h-5 w-5 text-primary" /><div className="mt-4 text-3xl font-semibold">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>;
}
