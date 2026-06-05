import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getRelease, submitRelease } from "@/lib/api-creator";

export const Route = createFileRoute("/_authenticated/releases/$releaseId")({
  component: ReleaseDetailPage,
});

function ReleaseDetailPage() {
  const { releaseId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["release", releaseId],
    queryFn: () => getRelease(releaseId),
  });

  const submit = useMutation({
    mutationFn: () => submitRelease(releaseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release", releaseId] });
      qc.invalidateQueries({ queryKey: ["releases"] });
    },
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </PageContainer>
    );
  }
  if (error || !data) {
    return (
      <PageContainer>
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Release not found"}</p>
        <Link to="/releases" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to releases
        </Link>
      </PageContainer>
    );
  }

  const { release, tracks } = data;
  const canSubmit = release.status === "draft" || release.status === "rejected";

  return (
    <PageContainer>
      <Link
        to="/releases"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All releases
      </Link>

      <PageHeader
        title={release.title || "Untitled release"}
        description={`${release.releaseType?.toUpperCase() ?? ""} · status: ${release.status.replace(/_/g, " ")}`}
        actions={
          canSubmit ? (
            <Button type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for review
            </Button>
          ) : (
            <Link
              to="/distribution"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              View distribution
            </Link>
          )
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Tracks ({tracks.length})</h2>
          {tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">This release has no tracks yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tracks.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <Link
                    to="/tracks/$trackId"
                    params={{ trackId: t.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {i + 1}. {t.title || "Untitled"}
                  </Link>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
          <Row label="Release date" value={release.releaseDate ?? "—"} />
          <Row label="UPC" value={release.upc ?? "—"} />
          <Row label="Submitted" value={release.submittedAt ?? "—"} />
          <Row label="Approved" value={release.approvedAt ?? "—"} />
          {release.rejectionReason ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {release.rejectionReason}
            </div>
          ) : null}
          {release.distributionPlatforms && release.distributionPlatforms.length > 0 ? (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Platforms</div>
              <div className="flex flex-wrap gap-1">
                {release.distributionPlatforms.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
