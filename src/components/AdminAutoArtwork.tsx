import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Users, Disc3, Sparkles, AlertTriangle, Music, Disc, Radio } from "lucide-react";
import {
  bulkFetchMissingAlbumArtwork,
  bulkFetchMissingArtistArtwork,
  bulkRegenerateArtistArtwork,
  bulkRegenerateTrackArtwork,
  bulkRegenerateSingleArtwork,
  bulkRegenerateAzuracastAlbumArtwork,
  type BulkResult,
  type RegenerateResult,
} from "@/lib/artwork.functions";

type ResultState =
  | { kind: "artists" | "albums"; res: BulkResult }
  | { kind: "regen"; res: RegenerateResult }
  | { kind: "tracks"; res: RegenerateResult }
  | { kind: "singles"; res: RegenerateResult }
  | { kind: "sweep"; res: RegenerateResult };

function renderSummary(result: ResultState) {
  switch (result.kind) {
    case "artists":
    case "albums": {
      const r = result.res;
      return (
        <ul className="space-y-1 text-muted-foreground">
          <li>Genomsökta: {r.scanned}</li>
          <li>Uppdaterade med omslag: {r.updated}</li>
          <li>Ingen träff i iTunes: {r.missed}</li>
          <li>Misslyckade: {r.failed}</li>
        </ul>
      );
    }
    case "regen":
    case "tracks":
    case "singles":
    case "sweep": {
      const r = result.res;
      return (
        <ul className="space-y-1 text-muted-foreground">
          <li>Genomsökta: {r.scanned}</li>
          <li>Uppdaterade: {r.updated}</li>
          <li>Källa iTunes: {r.bySource.itunes}</li>
          <li>Källa Deezer: {r.bySource.deezer}</li>
          <li>Källa MusicBrainz: {r.bySource.musicbrainz}</li>
          <li>Källa AI: {r.bySource.ai}</li>
          <li>Misslyckade: {r.failed}</li>
        </ul>
      );
    }
  }
}

export function AdminAutoArtwork() {
  const qc = useQueryClient();
  const fetchArtists = useServerFn(bulkFetchMissingArtistArtwork);
  const fetchAlbums = useServerFn(bulkFetchMissingAlbumArtwork);
  const regenerateAll = useServerFn(bulkRegenerateArtistArtwork);
  const regenerateTracks = useServerFn(bulkRegenerateTrackArtwork);
  const regenerateSingles = useServerFn(bulkRegenerateSingleArtwork);
  const regenerateAzAlbums = useServerFn(bulkRegenerateAzuracastAlbumArtwork);
  const [busy, setBusy] = useState<
    "artists" | "albums" | "regen" | "tracks" | "singles" | "sweep" | null
  >(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sweepProgress, setSweepProgress] = useState<string | null>(null);

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

  async function runRegenerate() {
    const ok = window.confirm(
      "Detta ersätter ALLA artistbilder. Söker först iTunes/Deezer med verifiering på artistnamn + låt, annars genereras en abstrakt AI-bild (förbrukar AI-credits). Fortsätt?",
    );
    if (!ok) return;
    setBusy("regen");
    setError(null);
    setResult(null);
    try {
      const res = await regenerateAll({ data: {} });
      setResult({ kind: "regen", res });
      qc.invalidateQueries({ queryKey: ["admin-artists"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runRegenerateTracks() {
    const ok = window.confirm(
      "Detta ersätter låt-omslag som importerats med AzuraCast-default. Söker iTunes → Deezer (verifierat på artist + låttitel), annars genereras en abstrakt AI-bild (förbrukar AI-credits). Max 100 per körning. Fortsätt?",
    );
    if (!ok) return;
    setBusy("tracks");
    setError(null);
    setResult(null);
    try {
      const res = await regenerateTracks({ data: {} });
      setResult({ kind: "tracks", res });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["admin-artists"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runRegenerateSingles() {
    const ok = window.confirm(
      "Detta hämtar nya omslag för ALLA singlar och skriver över befintliga. Söker iTunes → Deezer → MusicBrainz (verifierat på artist + titel), annars genereras ett unikt AI-omslag (förbrukar AI-credits). Både singelns omslag och dess låt-omslag uppdateras. Max 100 per körning. Fortsätt?",
    );
    if (!ok) return;
    setBusy("singles");
    setError(null);
    setResult(null);
    try {
      const res = await regenerateSingles({ data: {} });
      setResult({ kind: "singles", res });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["admin-artists"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runSweepRadioUppsala() {
    const ok = window.confirm(
      "Sveper igenom ALLA Radio Uppsala-importerade omslag (låtar + album) i batchar tills inga är kvar (max 20 batchar). Prioriterar iTunes → Deezer → MusicBrainz, AI som sista utväg. Redan AI-genererade och redan utbytta omslag rörs inte. Kan ta flera minuter. Fortsätt?",
    );
    if (!ok) return;
    setBusy("sweep");
    setError(null);
    setResult(null);
    setSweepProgress(null);

    const totals: RegenerateResult = {
      scanned: 0,
      updated: 0,
      failed: 0,
      bySource: { itunes: 0, deezer: 0, musicbrainz: 0, ai: 0, failed: 0 },
      details: [],
    };

    const accumulate = (r: RegenerateResult) => {
      totals.scanned += r.scanned;
      totals.updated += r.updated;
      totals.failed += r.failed;
      totals.bySource.itunes += r.bySource.itunes;
      totals.bySource.deezer += r.bySource.deezer;
      totals.bySource.musicbrainz += r.bySource.musicbrainz;
      totals.bySource.ai += r.bySource.ai;
      totals.bySource.failed += r.bySource.failed;
      totals.details.push(...r.details);
    };

    try {
      const MAX_BATCHES = 20;
      let batch = 0;
      while (batch < MAX_BATCHES) {
        batch++;
        setSweepProgress(`Batch ${batch}: låtar…`);
        const t = await regenerateTracks({ data: {} });
        accumulate(t);
        setSweepProgress(`Batch ${batch}: album…`);
        const a = await regenerateAzAlbums({ data: {} });
        accumulate(a);
        if (t.scanned === 0 && a.scanned === 0) break;
      }
      setResult({ kind: "sweep", res: totals });
      setSweepProgress(null);
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["admin-artists"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (totals.scanned > 0) setResult({ kind: "sweep", res: totals });
    } finally {
      setBusy(null);
      setSweepProgress(null);
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

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-base font-semibold">Regenerera ALLA artistbilder</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Skriver över alla artisters bilder. Verifierar artistnamn + en av artistens egna låttitlar
          mot iTunes, sedan Deezer. Om ingen verifierad träff hittas genereras en abstrakt,
          ansiktslös AI-bild (förbrukar AI-credits). Max 100 per körning.
        </p>
        <button
          onClick={runRegenerate}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {busy === "regen" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Regenerera alla (skriver över)
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Regenerera låt-omslag (AzuraCast-defaults)</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Hittar låtar vars omslag importerades från AzuraCast och försöker hämta riktigt omslag.
          Söker iTunes → Deezer (verifierat på artist + låttitel), annars genereras en abstrakt
          AI-bild (förbrukar AI-credits). Max 100 per körning, skriver över befintlig bild.
        </p>
        <button
          onClick={runRegenerateTracks}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === "tracks" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Music className="h-3.5 w-3.5" />
          )}
          Regenerera låt-omslag
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Disc className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Regenerera singel-omslag</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Hämtar nya omslag för alla singlar och skriver över befintliga. Söker iTunes → Deezer →
          MusicBrainz/Cover Art Archive (verifierat på artist + titel), annars genereras ett unikt
          AI-omslag (förbrukar AI-credits). Både singelns omslag och dess låt-omslag uppdateras. Max
          100 per körning.
        </p>
        <button
          onClick={runRegenerateSingles}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === "singles" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Disc className="h-3.5 w-3.5" />
          )}
          Regenerera singel-omslag
        </button>
      </div>

      <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Sveper bort ALLA Radio Uppsala-bilder</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Loopar låt- och album-regenereringen i upp till 20 batchar tills inga AzuraCast-default-omslag
          finns kvar. Prioritet: iTunes → Deezer → MusicBrainz → AI som sista utväg. Redan AI-genererade
          eller redan utbytta omslag ligger på andra paths och rörs inte.
        </p>
        <button
          onClick={runSweepRadioUppsala}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === "sweep" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radio className="h-3.5 w-3.5" />
          )}
          Svep bort Radio Uppsala-bilder
        </button>
        {sweepProgress && (
          <p className="mt-3 text-xs text-muted-foreground">{sweepProgress}</p>
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
            Resultat —{" "}
            {result.kind === "artists"
              ? "artister"
              : result.kind === "albums"
                ? "album"
                : result.kind === "tracks"
                  ? "låtar"
                  : result.kind === "singles"
                    ? "singlar"
                    : "regenerering"}
          </h3>
          {renderSummary(result)}
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
                    {"source" in d ? ` — [${d.source}]` : ""}
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