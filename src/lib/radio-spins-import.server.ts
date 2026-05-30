// Pulls play history from Radio Uppsala's AzuraCast station and records
// each spin as a "radio_spin" playback_event for the matching submission.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AZURACAST_BASE = "https://stream.radiouppsala.se";
const STATION_ID = 1;

export type RadioImportSummary = {
  windowStart: string;
  windowEnd: string;
  fetched: number;
  matched: number;
  inserted: number;
  skippedExisting: number;
  unmatched: number;
};

type HistoryRow = {
  played_at?: number; // unix seconds
  duration?: number;
  song?: {
    id?: string;
    text?: string;
    artist?: string;
    title?: string;
    isrc?: string | null;
  };
};

async function fetchHistory(
  apiKey: string,
  start: Date,
  end: Date,
): Promise<HistoryRow[]> {
  // AzuraCast's history endpoint takes `start`/`end` as query parameters in a
  // PHP-supported date format. Bare unix timestamps are rejected by AzuraCast's
  // parser, so send explicit UTC date strings instead.
  const formatDate = (date: Date) =>
    date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const params = new URLSearchParams({
    start: formatDate(start),
    end: formatDate(end),
  });
  const url = `${AZURACAST_BASE}/api/station/${STATION_ID}/history?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AzuraCast history ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as HistoryRow[];
  return Array.isArray(json) ? json : [];
}

export async function performRadioSpinsImport(opts: {
  since?: Date;
} = {}): Promise<RadioImportSummary> {
  const apiKey = process.env.AZURACAST_API_KEY;
  if (!apiKey) throw new Error("AZURACAST_API_KEY saknas");

  const now = new Date();
  // Determine window: from last successful run (or 7 days ago) to now.
  let windowStart = opts.since ?? null;
  if (!windowStart) {
    const { data: lastRun } = await supabaseAdmin
      .from("radio_import_runs" as never)
      .select("completed_at")
      .eq("status", "ok")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = (lastRun as { completed_at?: string } | null)?.completed_at;
    windowStart = last
      ? new Date(last)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  // Cap window to 14 days to avoid huge backfills if cron has been off.
  const earliest = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (windowStart < earliest) windowStart = earliest;

  // Insert run record
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("radio_import_runs" as never)
    .insert({
      source: "radio_uppsala",
      window_start: windowStart.toISOString(),
      window_end: now.toISOString(),
      status: "running",
    } as never)
    .select("id")
    .single();
  if (runErr) throw new Error(`run insert: ${runErr.message}`);
  const runId = (runRow as { id: string }).id;

  const summary: RadioImportSummary = {
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    fetched: 0,
    matched: 0,
    inserted: 0,
    skippedExisting: 0,
    unmatched: 0,
  };

  try {
    const history = await fetchHistory(apiKey, windowStart, now);
    summary.fetched = history.length;

    // Build lookup: azuracast song hash -> submission id. History returns
    // song.id = 32-char song hash, which is stored as `azuracast_song_id`.
    // We also fall back to `azuracast_unique_id` for legacy rows that haven't
    // been backfilled yet.
    const songIds = Array.from(
      new Set(history.map((h) => h.song?.id).filter((x): x is string => !!x)),
    );
    const idMap = new Map<string, string>();
    if (songIds.length > 0) {
      const { data: bySong, error: songErr } = await supabaseAdmin
        .from("submissions")
        .select("id, azuracast_song_id")
        .in("azuracast_song_id", songIds);
      if (songErr) throw new Error(`submission match (song_id): ${songErr.message}`);
      for (const m of (bySong ?? []) as Array<{ id: string; azuracast_song_id: string | null }>) {
        if (m.azuracast_song_id) idMap.set(m.azuracast_song_id, m.id);
      }
      // Legacy fallback: rader utan song_id backfill.
      const stillMissing = songIds.filter((id) => !idMap.has(id));
      if (stillMissing.length > 0) {
        const { data: byUnique } = await supabaseAdmin
          .from("submissions")
          .select("id, azuracast_unique_id")
          .in("azuracast_unique_id", stillMissing);
        for (const m of byUnique ?? []) {
          if (m.azuracast_unique_id) idMap.set(m.azuracast_unique_id, m.id);
        }
      }
    }

    for (const row of history) {
      const songId = row.song?.id;
      const playedAtSec = row.played_at;
      if (!songId || !playedAtSec) continue;
      const submissionId = idMap.get(songId);
      if (!submissionId) {
        summary.unmatched += 1;
        continue;
      }
      summary.matched += 1;
      const playedAtIso = new Date(playedAtSec * 1000).toISOString();
      const { error: insErr } = await supabaseAdmin
        .from("playback_events" as never)
        .insert({
          submission_id: submissionId,
          event_type: "radio_spin",
          source: "radio_uppsala",
          azuracast_song_id: songId,
          azuracast_played_at: playedAtIso,
          occurred_at: playedAtIso,
        } as never);
      if (insErr) {
        // Unique violation = already imported; that's fine.
        if (
          insErr.code === "23505" ||
          insErr.message?.includes("duplicate key")
        ) {
          summary.skippedExisting += 1;
        } else {
          throw new Error(`event insert: ${insErr.message}`);
        }
      } else {
        summary.inserted += 1;
      }
    }

    await supabaseAdmin
      .from("radio_import_runs" as never)
      .update({
        completed_at: new Date().toISOString(),
        status: "ok",
        spins_inserted: summary.inserted,
        spins_skipped: summary.skippedExisting,
      } as never)
      .eq("id", runId);
    return summary;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("radio_import_runs" as never)
      .update({
        completed_at: new Date().toISOString(),
        status: "failed",
        error: msg.slice(0, 1000),
        spins_inserted: summary.inserted,
        spins_skipped: summary.skippedExisting,
      } as never)
      .eq("id", runId);
    throw err;
  }
}