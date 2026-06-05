import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { listReleases } from "@/lib/api-creator";

export const Route = createFileRoute("/_authenticated/releases")({
  component: ReleasesPage,
});

function ReleasesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["releases"],
    queryFn: listReleases,
  });

  return (
    <PageContainer>
      <PageHeader title="My Releases" description="Singles, EPs, and albums you’ve created." />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load"}</p>
      ) : !data || data.releases.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No releases yet.</p>
          <Link to="/tracks" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Upload and submit tracks to build a release →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.releases.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <Link
                  to="/releases/$releaseId"
                  params={{ releaseId: r.id }}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {r.title || "Untitled"}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  {r.releaseType ? r.releaseType.toUpperCase() : "—"}
                  {r.releaseDate ? ` · ${r.releaseDate}` : ""}
                </div>
              </div>
              <span className="ml-3 shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {r.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
