import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Loader2, Radio, PlayCircle, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { getArtistStats } from "@/lib/stats.functions";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Statistik — Catalogus Musicus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <StatsPage />
    </ProtectedRoute>
  ),
});

function StatsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const fetchStats = useServerFn(getArtistStats);

  const { data, isLoading, error } = useQuery({
    queryKey: ["artist-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats({ data: {} }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" />
          {t("stats.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("stats.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("stats.title")}…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {t("stats.error")}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("stats.empty")}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              icon={<PlayCircle className="h-5 w-5" />}
              label={t("stats.plays")}
              total={data.totals.play}
              recent={data.totals.play30d}
              recentLabel={t("stats.kpi30d")}
            />
            <Kpi
              icon={<Headphones className="h-5 w-5" />}
              label={t("stats.completed")}
              total={data.totals.completed}
              recent={data.totals.completed30d}
              recentLabel={t("stats.kpi30d")}
            />
            <Kpi
              icon={<Radio className="h-5 w-5" />}
              label={t("stats.radio")}
              total={data.totals.radio}
              recent={data.totals.radio30d}
              recentLabel={t("stats.kpi30d")}
            />
          </div>

          {/* Per-track table */}
          <div className="mt-6 overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">{t("stats.title_col")}</th>
                  <th className="px-4 py-2">{t("stats.album")}</th>
                  <th className="px-4 py-2 text-right">{t("stats.plays")}</th>
                  <th className="px-4 py-2 text-right">{t("stats.completed")}</th>
                  <th className="px-4 py-2 text-right">{t("stats.radio")}</th>
                  <th className="px-4 py-2">{t("stats.lastPlayed")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.submissionId} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-2 font-medium text-foreground">
                      <Link
                        to="/catalog"
                        className="hover:underline"
                        title={r.title}
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.albumTitle ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.playCount.toLocaleString(i18n.language)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.completedCount.toLocaleString(i18n.language)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.radioSpinCount.toLocaleString(i18n.language)}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.lastPlayedAt
                        ? new Date(r.lastPlayedAt).toLocaleDateString(i18n.language, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : t("stats.never")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">{t("stats.description")}</p>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  total,
  recent,
  recentLabel,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  recent: number;
  recentLabel: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{total.toLocaleString()}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {recent.toLocaleString()} · {recentLabel}
      </div>
    </div>
  );
}