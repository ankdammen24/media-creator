import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import {
  getDistributionStatus,
  listReleases,
  type DistributionPlatformStatus,
} from "@/lib/api-creator";

const STATUS_COLOR: Record<DistributionPlatformStatus, string> = {
  pending: "text-muted-foreground",
  submitted: "text-blue-400",
  live: "text-emerald-500",
  rejected: "text-destructive",
  takedown: "text-amber-400",
};

export const Route = createFileRoute("/_authenticated/distribution")({
  component: DistributionPage,
});

function DistributionPage() {
  const releases = useQuery({
    queryKey: ["releases"],
    queryFn: listReleases,
  });

  const eligibleReleases = (releases.data?.releases ?? []).filter(
    (r) => r.status === "approved" || r.status === "scheduled" || r.status === "distributed",
  );

  const statuses = useQueries({
    queries: eligibleReleases.map((r) => ({
      queryKey: ["distribution", r.id],
      queryFn: () => getDistributionStatus(r.id),
      retry: 0,
    })),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Distribution"
        description="Where your approved releases are live across streaming platforms."
      />

      {releases.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : eligibleReleases.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No approved releases yet.
        </div>
      ) : (
        <div className="space-y-4">
          {eligibleReleases.map((r, i) => {
            const q = statuses[i];
            return (
              <section key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/releases/$releaseId"
                    params={{ releaseId: r.id }}
                    className="text-sm font-semibold hover:underline"
                  >
                    {r.title || "Untitled"}
                  </Link>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
                {q.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading platforms…</p>
                ) : q.error ? (
                  <p className="text-xs text-destructive">
                    {q.error instanceof Error ? q.error.message : "Failed to load"}
                  </p>
                ) : !q.data || q.data.platforms.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No platform info yet.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {q.data.platforms.map((p) => (
                      <li key={p.platform} className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-medium capitalize">{p.platform}</div>
                          {p.liveAt ? (
                            <div className="text-xs text-muted-foreground">Live since {p.liveAt}</div>
                          ) : p.submittedAt ? (
                            <div className="text-xs text-muted-foreground">Submitted {p.submittedAt}</div>
                          ) : null}
                          {p.rejectionReason ? (
                            <div className="mt-0.5 text-xs text-destructive">{p.rejectionReason}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium uppercase tracking-wide ${STATUS_COLOR[p.status]}`}>
                            {p.status}
                          </span>
                          {p.externalUrl ? (
                            <a
                              href={p.externalUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
