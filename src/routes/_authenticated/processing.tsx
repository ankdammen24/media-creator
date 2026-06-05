import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { listTracks } from "@/lib/api-creator";

const ACTIVE_STATUSES = new Set([
  "pending_upload",
  "uploaded",
  "processing",
]);

export const Route = createFileRoute("/_authenticated/processing")({
  component: ProcessingPage,
});

function ProcessingPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["tracks", "active"],
    queryFn: () => listTracks(),
    refetchInterval: 3000,
  });

  const active = (data?.tracks ?? []).filter((t) => ACTIVE_STATUSES.has(t.status));
  const recentlyFinished = (data?.tracks ?? [])
    .filter((t) => t.status === "processed" || t.status === "failed")
    .slice(0, 10);

  return (
    <PageContainer>
      <PageHeader
        title="Processing"
        description="Tracks currently being uploaded, transcoded, and analyzed."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load"}</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">In progress</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in progress.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {active.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-3">
                    <div>
                      <Link to="/tracks/$trackId" params={{ trackId: t.id }} className="text-sm font-medium hover:underline">
                        {t.title || "Untitled"}
                      </Link>
                      <div className="text-xs text-muted-foreground capitalize">{t.status.replace(/_/g, " ")}</div>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Recently finished</h2>
            {recentlyFinished.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent results.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {recentlyFinished.map((t) => (
                  <li key={t.id} className="flex items-center justify-between p-3">
                    <Link to="/tracks/$trackId" params={{ trackId: t.id }} className="text-sm font-medium hover:underline">
                      {t.title || "Untitled"}
                    </Link>
                    <span
                      className={`text-xs font-medium ${
                        t.status === "processed" ? "text-emerald-500" : "text-destructive"
                      }`}
                    >
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
}
