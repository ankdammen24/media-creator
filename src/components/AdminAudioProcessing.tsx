import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Waves, AlertCircle, CheckCircle2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  enqueueAudioProcessing,
  enqueueAudioBackfill,
  getAudioProcessingStats,
  getAudioProcessingLogs,
} from "@/lib/audio-processing.functions";

type ProcRow = {
  id: string;
  title: string;
  user_id: string;
  audio_path: string | null;
  audio_master_path: string | null;
  audio_web_path: string | null;
  processing_status: "pending" | "processing" | "done" | "failed" | "skipped";
  processing_error: string | null;
  loudness_i: number | null;
  loudness_tp: number | null;
  loudness_lra: number | null;
  processed_at: string | null;
  created_at: string;
  artist_profiles: { name: string } | null;
};

const STATUS_FILTERS = ["all", "pending", "processing", "failed", "done"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function AdminAudioProcessing() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("failed");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const retry = useServerFn(enqueueAudioProcessing);
  const backfill = useServerFn(enqueueAudioBackfill);
  const stats = useServerFn(getAudioProcessingStats);
  const logs = useServerFn(getAudioProcessingLogs);

  const statsQuery = useQuery({
    queryKey: ["audio-stats"],
    queryFn: () => stats(),
    refetchInterval: 10_000,
  });

  const logsQuery = useQuery({
    queryKey: ["audio-logs"],
    queryFn: () => logs({ data: { limit: 100 } }),
    refetchInterval: 8_000,
  });

  const listQuery = useQuery({
    queryKey: ["audio-rows", statusFilter],
    queryFn: async (): Promise<ProcRow[]> => {
      let q = supabase
        .from("submissions")
        .select(
          "id, title, user_id, audio_path, audio_master_path, audio_web_path, processing_status, processing_error, loudness_i, loudness_tp, loudness_lra, processed_at, created_at, artist_profiles!submissions_artist_profile_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") q = q.eq("processing_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ProcRow[];
    },
    refetchInterval: 8_000,
  });

  async function retryOne(id: string) {
    setRetrying(id);
    try {
      await retry({ data: { submissionId: id, force: true } });
      await qc.invalidateQueries({ queryKey: ["audio-rows"] });
      await qc.invalidateQueries({ queryKey: ["audio-stats"] });
      await qc.invalidateQueries({ queryKey: ["audio-logs"] });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(null);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await backfill({ data: { limit: 50 } });
      setBackfillResult(
        `Köade ${res.queued}, hoppade över ${res.skipped}, misslyckade ${res.failed} (av ${res.considered}).`,
      );
      await qc.invalidateQueries({ queryKey: ["audio-rows"] });
      await qc.invalidateQueries({ queryKey: ["audio-stats"] });
      await qc.invalidateQueries({ queryKey: ["audio-logs"] });
    } catch (e) {
      setBackfillResult(e instanceof Error ? e.message : String(e));
    } finally {
      setBackfilling(false);
    }
  }

  const s = statsQuery.data;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Waves className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Ljud-bearbetning</h2>
        </div>
        {!s ? (
          <p className="text-xs text-muted-foreground">Hämtar status…</p>
        ) : (
          <>
            {!s.workerConfigured && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <code className="rounded bg-secondary px-1">AUDIO_PROCESSOR_URL</code> är inte konfigurerad.
                  Jobb sätts till <em>pending</em> och kan köras efter att VPS-processorn är på plats.
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Stat label="Totalt" value={s.total} />
              <Stat label="Med master" value={s.withMaster} />
              <Stat label="Pending" value={s.counts.pending ?? 0} />
              <Stat label="Processing" value={s.counts.processing ?? 0} />
              <Stat label="Done" value={s.counts.done ?? 0} tone="ok" />
              <Stat label="Failed" value={s.counts.failed ?? 0} tone="bad" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={runBackfill}
                disabled={backfilling}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {backfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Backfill 50 äldre låtar
              </button>
              {backfillResult && (
                <span className="self-center text-xs text-muted-foreground">{backfillResult}</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Låtar</h3>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded px-2 py-1 ${
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {listQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Laddar…</p>
        ) : listQuery.data && listQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3">Titel</th>
                  <th className="py-1.5 pr-3">Status</th>
                  <th className="py-1.5 pr-3">Original</th>
                  <th className="py-1.5 pr-3">Master</th>
                  <th className="py-1.5 pr-3">Web</th>
                  <th className="py-1.5 pr-3">LUFS (I / TP / LRA)</th>
                  <th className="py-1.5 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-foreground">{r.title}</div>
                      <div className="text-muted-foreground">{r.artist_profiles?.name ?? "—"}</div>
                      {r.processing_error && (
                        <div className="mt-1 text-[10px] text-destructive">{r.processing_error}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={r.processing_status} />
                    </td>
                    <td className="py-2 pr-3">{r.audio_path ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{r.audio_master_path ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{r.audio_web_path ? "✓" : "—"}</td>
                    <td className="py-2 pr-3 font-mono">
                      {r.loudness_i != null
                        ? `${r.loudness_i?.toFixed(1)} / ${r.loudness_tp?.toFixed(1)} / ${r.loudness_lra?.toFixed(1)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => retryOne(r.id)}
                        disabled={retrying === r.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                      >
                        {retrying === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Inga låtar matchar filtret.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const color =
    tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProcRow["processing_status"] }) {
  const styles: Record<string, string> = {
    done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pending: "bg-muted text-muted-foreground border-border",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    skipped: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  const Icon = status === "done" ? CheckCircle2 : status === "failed" ? AlertCircle : Loader2;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        styles[status] ?? styles.pending
      }`}
    >
      <Icon className={`h-2.5 w-2.5 ${status === "processing" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}