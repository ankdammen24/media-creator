import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react";
import {
  parseCatalogImport,
  applyCatalogImport,
} from "@/lib/catalog-import.functions";

type Row = {
  id: string;
  sheet_name: string | null;
  row_index: number | null;
  artist_name_raw: string | null;
  album_title_raw: string | null;
  track_title_raw: string | null;
  upc_raw: string | null;
  isrc_raw: string | null;
  match_status: string;
  matched_artist_id: string | null;
  matched_album_id: string | null;
  matched_submission_id: string | null;
  proposed_changes: Record<string, { table: string; field: string; before: string | null; after: string }> | null;
  notes: string | null;
};

type Preview = {
  runId: string;
  summary: Record<string, number>;
  rows: Row[];
};

function statusColor(s: string) {
  switch (s) {
    case "matched":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "partial":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "skipped":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "duplicate":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "conflict":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "unmatched":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

export function AdminCatalogImport() {
  const parseFn = useServerFn(parseCatalogImport);
  const applyFn = useServerFn(applyCatalogImport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "apply" | "overwrite" | "skip">>({});
  const [applyResult, setApplyResult] = useState<{ applied: number; skipped: number; failed: number } | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setPreview(null);
    setApplyResult(null);
    try {
      const base64 = await fileToBase64(file);
      const res = (await parseFn({ data: { filename: file.name, fileBase64: base64 } })) as Preview;
      setPreview(res);
      // default decisions: apply for matched, skip for everything else
      const init: Record<string, "apply" | "overwrite" | "skip"> = {};
      for (const r of res.rows) {
        init[r.id] = r.match_status === "matched" ? "apply" : "skip";
      }
      setDecisions(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const list = Object.entries(decisions).map(([rowId, action]) => ({ rowId, action }));
      const res = await applyFn({ data: { runId: preview.runId, decisions: list } });
      setApplyResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold">Catalog Metadata Import (UPC / ISRC)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ladda upp en .xlsx-fil. Importen matchar mot befintliga artister, album och
          låtar — den skapar aldrig nya poster. Tomma UPC/ISRC-fält fylls i automatiskt;
          för redan ifyllda värden måste du välja <em>Overwrite</em> per rad.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Upload className="h-3.5 w-3.5" />
          Välj .xlsx
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {busy && (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Arbetar…
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {preview.summary.total ?? preview.rows.length} rader
            </span>
            <Badge label={`${preview.summary.matched ?? 0} matched`} cls={statusColor("matched")} />
            <Badge label={`${preview.summary.conflict ?? 0} conflict`} cls={statusColor("conflict")} />
            <Badge label={`${preview.summary.duplicate ?? 0} duplicate`} cls={statusColor("duplicate")} />
            <Badge label={`${preview.summary.skipped ?? 0} skipped`} cls={statusColor("skipped")} />
            <Badge label={`${preview.summary.partial ?? 0} partial`} cls={statusColor("partial")} />
            <Badge label={`${preview.summary.unmatched ?? 0} unmatched`} cls={statusColor("unmatched")} />
            <button
              onClick={apply}
              disabled={busy || !!applyResult}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Skriv valda ändringar
            </button>
          </div>

          {applyResult && (
            <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              Klar — {applyResult.applied} applicerade, {applyResult.skipped} hoppades över,{" "}
              {applyResult.failed} misslyckades.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Sheet</th>
                  <th className="py-2 pr-3">Album</th>
                  <th className="py-2 pr-3">Track</th>
                  <th className="py-2 pr-3">UPC</th>
                  <th className="py-2 pr-3">ISRC</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const hasOverwrite = r.proposed_changes
                    ? Object.values(r.proposed_changes).some((p) => p.before !== null)
                    : false;
                  const canApply = !!(r.proposed_changes && Object.keys(r.proposed_changes).length > 0);
                  return (
                    <tr key={r.id} className="border-b border-border/60 align-top">
                      <td className="py-1.5 pr-3 text-muted-foreground">{r.sheet_name}</td>
                      <td className="py-1.5 pr-3">{r.album_title_raw ?? "—"}</td>
                      <td className="py-1.5 pr-3">{r.track_title_raw ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono">{r.upc_raw ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono">{r.isrc_raw ?? "—"}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(r.match_status)}`}>
                          {r.match_status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{r.notes ?? ""}</td>
                      <td className="py-1.5 pr-3">
                        <select
                          value={decisions[r.id] ?? "skip"}
                          onChange={(e) =>
                            setDecisions((m) => ({ ...m, [r.id]: e.target.value as "apply" | "overwrite" | "skip" }))
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          disabled={!canApply}
                        >
                          <option value="skip">Skip</option>
                          <option value="apply" disabled={!canApply}>Apply</option>
                          <option value="overwrite" disabled={!hasOverwrite}>Overwrite</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

// keep unused icon imports from tripping the bundler in case of refactors
void AlertTriangle;
void XCircle;