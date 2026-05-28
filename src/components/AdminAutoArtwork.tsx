import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Users, Disc3 } from "lucide-react";
import {
  bulkFetchMissingAlbumArtwork,
  bulkFetchMissingArtistArtwork,
  type BulkResult,
} from "@/lib/artwork.functions";

export function AdminAutoArtwork() {
  const qc = useQueryClient();
  const fetchArtists = useServerFn(bulkFetchMissingArtistArtwork);
  const fetchAlbums = useServerFn(bulkFetchMissingAlbumArtwork);
  const [busy, setBusy] = useState<"artists" | "albums" | null>(null);
  const [result, setResult] = useState<{ kind: "artists" | "albums"; res: BulkResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "artists" | "albums") {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const res =
        kind === "artists"
          ? await fetchArtists({ data: {} })
          : await fetchAlbums({ data: {} });
      setResult({ kind, res });
      qc.invalidateQueries({ queryKey: ["admin-artists"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Auto-omslag från iTunes</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Hämtar gratis officiella omslag från iTunes Search API för artister och album som saknar
          bild. Max 50 per körning. Inget AI används — saknas träff lämnas fältet tomt.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run("artists")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {busy === "artists" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            Hämta saknade artist-bilder
          </button>
          <button
            onClick={() => run("albums")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === "albums" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Disc3 className="h-3.5 w-3.5" />
            )}
            Hämta saknade album-omslag
          </button>
        </div>
        {busy && (
          <p className="mt-3 text-xs text-muted-foreground">
            Kör… ~1 sek per post. Stäng inte fliken.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <h3 className="mb-2 font-semibold">
            Resultat — {result.kind === "artists" ? "artister" : "album"}
          </h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>Genomsökta: {result.res.scanned}</li>
            <li>Uppdaterade med omslag: {result.res.updated}</li>
            <li>Ingen träff i iTunes: {result.res.missed}</li>
            <li>Misslyckade: {result.res.failed}</li>
          </ul>
          {result.res.details.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Visa detaljer
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {result.res.details.map((d) => (
                  <li
                    key={d.id}
                    className={d.ok ? "text-emerald-600" : "text-muted-foreground"}
                  >
                    {d.ok ? "✓" : "·"} {d.name}
                    {d.reason ? ` — ${d.reason}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}