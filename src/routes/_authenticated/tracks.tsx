import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/AppShell";
import { listTracks, type TrackStatus } from "@/lib/api-creator";

const FILTERS: Array<{ value: TrackStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "processed", label: "Processed" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "distributed", label: "Distributed" },
];

export const Route = createFileRoute("/_authenticated/tracks")({
  component: TracksPage,
});

function TracksPage() {
  const [filter, setFilter] = useState<TrackStatus | "all">("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["tracks", filter],
    queryFn: () => listTracks({ status: filter }),
  });

  return (
    <PageContainer>
      <PageHeader title="My Tracks" description="All tracks you’ve uploaded." />

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-md border border-border p-1 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded px-2.5 py-1 ${
              filter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load"}</p>
      ) : !data || data.tracks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No tracks here yet.</p>
          <Link to="/upload" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Upload your first track →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.tracks.map((t) => (
            <li key={t.id} className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <Link
                  to="/tracks/$trackId"
                  params={{ trackId: t.id }}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {t.title || "Untitled"}
                </Link>
                <div className="truncate text-xs text-muted-foreground">{t.artist ?? "—"}</div>
              </div>
              <span className="ml-3 shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
