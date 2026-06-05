import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Upload, Activity, Music, Disc3, Radio } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { getDashboard } from "@/lib/api-creator";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    retry: 0,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Overview of your tracks, releases, and recent activity."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction to="/upload" icon={Upload} label="Upload music" />
        <QuickAction to="/processing" icon={Activity} label="Processing" />
        <QuickAction to="/tracks" icon={Music} label="My tracks" />
        <QuickAction to="/releases" icon={Disc3} label="My releases" />
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading summary…
        </div>
      ) : error ? (
        <DashboardError error={error} />
      ) : data ? (
        <DashboardContent data={data} />
      ) : null}
    </PageContainer>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: "/upload" | "/processing" | "/tracks" | "/releases" | "/distribution";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-secondary"
    >
      <span className="rounded-md bg-secondary p-2 group-hover:bg-background">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function DashboardError({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  const is401 = error instanceof ApiError && error.status === 401;
  return (
    <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="font-medium text-destructive">Couldn’t load dashboard</div>
      <p className="mt-1 text-muted-foreground">{msg}</p>
      {is401 ? <p className="mt-1 text-muted-foreground">Your session may have expired — try signing in again.</p> : null}
    </div>
  );
}

function DashboardContent({
  data,
}: {
  data: Awaited<ReturnType<typeof getDashboard>>;
}) {
  const trackEntries = Object.entries(data.trackCounts ?? {});
  const releaseEntries = Object.entries(data.releaseCounts ?? {});

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Tracks</h2>
        {trackEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracks yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {trackEntries.map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Releases</h2>
        {releaseEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No releases yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {releaseEntries.map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.recentTracks && data.recentTracks.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent tracks</h2>
            <Link to="/tracks" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-border text-sm">
            {data.recentTracks.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <Link
                  to="/tracks/$trackId"
                  params={{ trackId: t.id }}
                  className="font-medium hover:underline"
                >
                  {t.title || "Untitled"}
                </Link>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.recentReleases && data.recentReleases.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent releases</h2>
            <Link to="/releases" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-border text-sm">
            {data.recentReleases.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link
                  to="/releases/$releaseId"
                  params={{ releaseId: r.id }}
                  className="font-medium hover:underline"
                >
                  {r.title || "Untitled"}
                </Link>
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Radio className="h-3 w-3" />
                  {r.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
