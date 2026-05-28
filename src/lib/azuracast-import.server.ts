// Server-only kärnimplementation av en-gångs import från Radio Uppsalas
// AzuraCast-station in i denna katalog. Anropas av motsvarande server-fn.
// Använder service-role-klienten så att RLS inte stör mass-importen.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AZURACAST_BASE = "https://stream.radiouppsala.se";
const STATION_ID = 1;
const MIN_DURATION_SECONDS = 40;

export type AzFile = {
  id?: number;
  unique_id?: string;
  path?: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  length?: number;
  art?: string;
  links?: { download?: string; play?: string; art?: string };
};

export type ImportSummary = {
  total: number;
  considered: number;
  inserted: number;
  skippedExisting: number;
  skippedNonMusic: number;
  skippedShort: number;
  failed: number;
  failures: { azId: string; title?: string; reason: string }[];
  dryRun: boolean;
};

function isMusic(file: AzFile): boolean {
  const path = (file.path || "").toLowerCase();
  const genre = (file.genre || "").toLowerCase();
  if (path.includes("program") || genre.includes("program")) return false;
  if (path.includes("intervju") || genre.includes("intervju")) return false;
  if (path.includes("arkiv") || genre.includes("arkiv")) return false;
  return true;
}

function sourceUrl(file: AzFile): string | null {
  // Använd /file/{id}/play — fungerar utan att on-demand är aktiverat.
  // /file/{id}/download returnerar 405 utan on-demand-stödet.
  if (file.links?.play) {
    return file.links.play.startsWith("http")
      ? file.links.play
      : `${AZURACAST_BASE}${file.links.play}`;
  }
  if (file.id != null) {
    return `${AZURACAST_BASE}/api/station/${STATION_ID}/file/${file.id}/play`;
  }
  return null;
}

function artUrl(file: AzFile): string | null {
  if (file.art) {
    return file.art.startsWith("http") ? file.art : `${AZURACAST_BASE}${file.art}`;
  }
  if (file.links?.art) {
    return file.links.art.startsWith("http") ? file.links.art : `${AZURACAST_BASE}${file.links.art}`;
  }
  return null;
}

function fileBasename(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  const last = path.split("/").pop() || fallback;
  return last.replace(/\.[a-zA-Z0-9]+$/, "") || fallback;
}

async function ensureArtistProfile(
  adminUserId: string,
  rawName: string | undefined,
  cache: Map<string, string>,
): Promise<string> {
  const name = (rawName || "").trim() || "Okänd artist";
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  // Försök hitta befintlig (case-insensitivt)
  const { data: existing, error: findErr } = await supabaseAdmin
    .from("artist_profiles")
    .select("id, name")
    .ilike("name", name)
    .limit(1);
  if (findErr) throw new Error(`artist lookup: ${findErr.message}`);
  if (existing && existing.length > 0) {
    cache.set(key, existing[0].id);
    return existing[0].id;
  }

  const { data: created, error: insErr } = await supabaseAdmin
    .from("artist_profiles")
    .insert({ name, user_id: adminUserId })
    .select("id")
    .single();
  if (insErr) throw new Error(`artist insert: ${insErr.message}`);
  cache.set(key, created.id);
  return created.id;
}

export async function performAzuracastImport(
  adminUserId: string,
  opts: { dryRun?: boolean; limit?: number } = {},
): Promise<ImportSummary> {
  const apiKey = process.env.AZURACAST_API_KEY;
  if (!apiKey) throw new Error("AZURACAST_API_KEY saknas");

  const summary: ImportSummary = {
    total: 0,
    considered: 0,
    inserted: 0,
    skippedExisting: 0,
    skippedNonMusic: 0,
    skippedShort: 0,
    failed: 0,
    failures: [],
    dryRun: !!opts.dryRun,
  };

  // Lista alla filer
  const res = await fetch(`${AZURACAST_BASE}/api/station/${STATION_ID}/files`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AzuraCast files ${res.status}: ${body.slice(0, 300)}`);
  }
  const files = (await res.json()) as AzFile[];
  summary.total = files.length;

  // Förladda redan importerade unique_ids
  const existing = new Set<string>();
  {
    let from = 0;
    const page = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .select("azuracast_unique_id")
        .not("azuracast_unique_id", "is", null)
        .range(from, from + page - 1);
      if (error) throw new Error(`existing lookup: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data) if (r.azuracast_unique_id) existing.add(r.azuracast_unique_id);
      if (data.length < page) break;
      from += page;
    }
  }

  const artistCache = new Map<string, string>();
  let processed = 0;

  for (const file of files) {
    if (opts.limit && summary.inserted >= opts.limit) break;
    const azId = file.unique_id || (file.id != null ? String(file.id) : null);
    if (!azId) {
      summary.failed += 1;
      summary.failures.push({ azId: "(saknar id)", title: file.title, reason: "saknar unique_id/id" });
      continue;
    }

    if (!isMusic(file)) {
      summary.skippedNonMusic += 1;
      continue;
    }
    // Skippa bara filer vi VET är korta. AzuraCast returnerar 0 för filer
    // som inte hunnit analyseras — då vill vi inte felklassa dem som jinglar.
    if (file.length != null && file.length > 0 && file.length < MIN_DURATION_SECONDS) {
      summary.skippedShort += 1;
      continue;
    }
    if (existing.has(azId)) {
      summary.skippedExisting += 1;
      continue;
    }

    summary.considered += 1;
    if (opts.dryRun) continue;

    try {
      const dl = sourceUrl(file);
      if (!dl) throw new Error("ingen källänk (play)");

      const audioRes = await fetch(dl, { headers: { "X-API-Key": apiKey } });
      if (!audioRes.ok) throw new Error(`download ${audioRes.status}`);
      const audioBlob = await audioRes.blob();
      const audioContentType = audioRes.headers.get("content-type") || "audio/mpeg";
      const audioPath = `${adminUserId}/azuracast/${azId}.mp3`;

      const upAudio = await supabaseAdmin.storage
        .from("audio")
        .upload(audioPath, audioBlob, { contentType: audioContentType, upsert: true });
      if (upAudio.error) throw new Error(`audio upload: ${upAudio.error.message}`);

      // Artwork — frivilligt
      let artworkPath = "";
      const au = artUrl(file);
      if (au) {
        try {
          const artRes = await fetch(au, { headers: { "X-API-Key": apiKey } });
          if (artRes.ok) {
            const artBlob = await artRes.blob();
            const ct = artRes.headers.get("content-type") || "image/jpeg";
            const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
            artworkPath = `${adminUserId}/azuracast/${azId}.${ext}`;
            const upArt = await supabaseAdmin.storage
              .from("artwork")
              .upload(artworkPath, artBlob, { contentType: ct, upsert: true });
            if (upArt.error) {
              console.warn(`artwork upload ${azId}: ${upArt.error.message}`);
              artworkPath = "";
            }
          }
        } catch (e) {
          console.warn(`artwork fetch ${azId}:`, e);
        }
      }

      const artistId = await ensureArtistProfile(adminUserId, file.artist, artistCache);
      const title = (file.title && file.title.trim()) || fileBasename(file.path, "Utan titel");
      const now = new Date().toISOString();

      const { error: insErr } = await supabaseAdmin.from("submissions").insert({
        title,
        description: null,
        media_type: "music",
        status: "approved",
        audio_path: audioPath,
        artwork_path: artworkPath || "",
        user_id: adminUserId,
        artist_profile_id: artistId,
        approved_at: now,
        approved_by: adminUserId,
        reviewed_at: now,
        reviewed_by: adminUserId,
        azuracast_unique_id: azId,
      });
      if (insErr) {
        // Rensa upp om submission-insert failade
        await supabaseAdmin.storage.from("audio").remove([audioPath]);
        if (artworkPath) await supabaseAdmin.storage.from("artwork").remove([artworkPath]);
        throw new Error(`submission insert: ${insErr.message}`);
      }

      summary.inserted += 1;
      existing.add(azId);
    } catch (e) {
      summary.failed += 1;
      summary.failures.push({
        azId,
        title: file.title,
        reason: e instanceof Error ? e.message : String(e),
      });
    }

    processed += 1;
    // Frivillig liten paus så vi inte hamrar AzuraCast
    if (processed % 20 === 0) await new Promise((r) => setTimeout(r, 100));
  }

  return summary;
}