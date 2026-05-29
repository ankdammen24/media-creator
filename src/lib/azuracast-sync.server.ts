// Server-only: push-sync av godkända musik-submissions till AzuraCast-mappen
// "Synced_music/" på stream.radiouppsala.se. Katalogen är master.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AZURACAST_BASE = "https://stream.radiouppsala.se";
const STATION_ID = 1;
const SYNC_FOLDER = "Synced_music";
const DEFAULT_PLAYLIST_NAME = "default";
// Säkerhetsspärr: om diff:en raderar mer än denna andel av speglade filer,
// avbryt rensningen och pusha bara nya.
const MAX_DELETE_RATIO = 0.3;

type AzFile = {
  id: number;
  unique_id?: string;
  path: string;
  length?: number;
  playlists?: { id: number; name: string }[];
};

type AzPlaylist = { id: number; name: string };

export type AzSyncSummary = {
  uploaded: { submissionId: string; azFileId: number }[];
  deleted: { azFileId: number; path: string }[];
  skipped: { submissionId: string; reason: string }[];
  failures: { submissionId?: string; azFileId?: number; reason: string }[];
  protectionTriggered: boolean;
  dryRun: boolean;
};

function apiKey(): string {
  const key = process.env.AZURACAST_API_KEY;
  if (!key) throw new Error("AZURACAST_API_KEY saknas");
  return key;
}

async function azFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey());
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${AZURACAST_BASE}${path}`, { ...init, headers });
}

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "track";
}

function extFromPath(p: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(p);
  return m ? m[1].toLowerCase() : "mp3";
}

function buildAzPath(sub: {
  id: string;
  title: string;
  artist_name: string;
  audio_path: string;
}): string {
  const ext = extFromPath(sub.audio_path);
  return `${SYNC_FOLDER}/${sub.id}__${slugify(sub.artist_name)}__${slugify(sub.title)}.${ext}`;
}

function submissionIdFromPath(path: string): string | null {
  // "Synced_music/<uuid>__..."
  const m = /^Synced_music\/([0-9a-f-]{36})__/i.exec(path);
  return m ? m[1] : null;
}

export async function listSyncedFiles(): Promise<AzFile[]> {
  const res = await azFetch(`/api/station/${STATION_ID}/files`);
  if (!res.ok) {
    throw new Error(`AzuraCast list files ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const all = (await res.json()) as AzFile[];
  return all.filter((f) => typeof f.path === "string" && f.path.startsWith(`${SYNC_FOLDER}/`));
}

let cachedPlaylistId: number | null = null;
async function getDefaultPlaylistId(): Promise<number> {
  if (cachedPlaylistId != null) return cachedPlaylistId;
  const res = await azFetch(`/api/station/${STATION_ID}/playlists`);
  if (!res.ok) {
    throw new Error(`AzuraCast playlists ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const list = (await res.json()) as AzPlaylist[];
  const match = list.find((p) => p.name?.toLowerCase() === DEFAULT_PLAYLIST_NAME);
  if (!match) throw new Error(`AzuraCast playlist "${DEFAULT_PLAYLIST_NAME}" hittades inte`);
  cachedPlaylistId = match.id;
  return match.id;
}

async function fetchAudioAsBase64(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from("audio").download(storagePath);
  if (error || !data) throw new Error(`audio download: ${error?.message ?? "ingen data"}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  // base64-encoda i chunks för att undvika stack overflow i String.fromCharCode
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadToAzuracast(params: {
  path: string;
  base64: string;
}): Promise<number> {
  const res = await azFetch(`/api/station/${STATION_ID}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: params.path, file: params.base64 }),
  });
  if (!res.ok) {
    throw new Error(`AzuraCast upload ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const created = (await res.json()) as { id?: number };
  if (typeof created.id !== "number") {
    throw new Error(`AzuraCast upload: oväntat svar ${JSON.stringify(created).slice(0, 200)}`);
  }
  return created.id;
}

async function assignToPlaylist(fileId: number, playlistId: number): Promise<void> {
  const res = await azFetch(`/api/station/${STATION_ID}/file/${fileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlists: [{ id: playlistId }] }),
  });
  if (!res.ok) {
    throw new Error(`AzuraCast playlist-assign ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

async function deleteAzFile(fileId: number): Promise<void> {
  const res = await azFetch(`/api/station/${STATION_ID}/file/${fileId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`AzuraCast delete ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

type CatalogTrack = {
  id: string;
  title: string;
  audio_path: string;
  audio_web_path: string | null;
  azuracast_file_id: number | null;
  artist_name: string;
};

async function loadApprovedMusic(): Promise<CatalogTrack[]> {
  const out: CatalogTrack[] = [];
  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, title, audio_path, audio_web_path, azuracast_file_id, artist_profiles!submissions_artist_profile_id_fkey(name)",
      )
      .eq("status", "approved")
      .eq("media_type", "music")
      .range(from, from + page - 1);
    if (error) throw new Error(`approved music lookup: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as unknown as Array<{
      id: string;
      title: string;
      audio_path: string;
      audio_web_path: string | null;
      azuracast_file_id: number | null;
      artist_profiles: { name: string } | null;
    }>) {
      out.push({
        id: r.id,
        title: r.title,
        audio_path: r.audio_path,
        audio_web_path: r.audio_web_path,
        azuracast_file_id: r.azuracast_file_id,
        artist_name: r.artist_profiles?.name ?? "Unknown",
      });
    }
    if (data.length < page) break;
    from += page;
  }
  return out;
}

/**
 * Pusha ett enskilt submission till AzuraCast (används vid approve).
 * Idempotent: om submission redan har azuracast_file_id som matchar en
 * existerande fil i Synced_music/, hoppas uppladdningen över.
 */
export async function pushSubmissionToAzuracast(submissionId: string): Promise<{
  azFileId: number;
  skipped?: boolean;
}> {
  const { data: sub, error } = await supabaseAdmin
    .from("submissions")
    .select(
      "id, title, status, media_type, audio_path, audio_web_path, azuracast_file_id, artist_profiles!submissions_artist_profile_id_fkey(name)",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error("submission not found");
  if (sub.status !== "approved" || sub.media_type !== "music") {
    throw new Error("submission är inte approved music");
  }

  const track: CatalogTrack = {
    id: sub.id,
    title: sub.title,
    audio_path: sub.audio_path,
    audio_web_path: sub.audio_web_path,
    azuracast_file_id: sub.azuracast_file_id,
    artist_name: (sub as unknown as { artist_profiles: { name: string } | null })
      .artist_profiles?.name ?? "Unknown",
  };

  // Om vi redan har ett fil-id, verifiera att det finns på AzuraCast.
  if (track.azuracast_file_id != null) {
    const existing = await listSyncedFiles();
    if (existing.some((f) => f.id === track.azuracast_file_id)) {
      return { azFileId: track.azuracast_file_id, skipped: true };
    }
  }

  const playlistId = await getDefaultPlaylistId();
  const path = buildAzPath({
    id: track.id,
    title: track.title,
    artist_name: track.artist_name,
    audio_path: track.audio_web_path ?? track.audio_path,
  });
  const base64 = await fetchAudioAsBase64(track.audio_web_path ?? track.audio_path);
  const azFileId = await uploadToAzuracast({ path, base64 });
  await assignToPlaylist(azFileId, playlistId);

  await supabaseAdmin
    .from("submissions")
    .update({
      azuracast_file_id: azFileId,
      azuracast_synced_at: new Date().toISOString(),
      azuracast_sync_error: null,
    })
    .eq("id", submissionId);

  return { azFileId };
}

/**
 * Full diff-sync: speglar approved music till Synced_music/.
 * - Laddar upp saknade
 * - Raderar AzuraCast-filer i Synced_music/ som inte längre finns i katalogen
 *   (med MAX_DELETE_RATIO som skyddsspärr)
 */
export async function syncCatalogToAzuracast(opts: { dryRun?: boolean } = {}): Promise<AzSyncSummary> {
  const summary: AzSyncSummary = {
    uploaded: [],
    deleted: [],
    skipped: [],
    failures: [],
    protectionTriggered: false,
    dryRun: !!opts.dryRun,
  };

  const [tracks, azFiles] = await Promise.all([loadApprovedMusic(), listSyncedFiles()]);

  // Indexera AzuraCast-filerna efter submission-id (utvunnet ur sökvägen)
  const azBySubmissionId = new Map<string, AzFile>();
  const azOrphans: AzFile[] = []; // filer i Synced_music/ utan giltigt submission-id
  for (const f of azFiles) {
    const subId = submissionIdFromPath(f.path);
    if (subId) {
      azBySubmissionId.set(subId, f);
    } else {
      azOrphans.push(f);
    }
  }

  const wantedIds = new Set(tracks.map((t) => t.id));

  // 1) Räkna raderingskandidater för säkerhetsspärr
  const deletionCandidates: AzFile[] = [];
  for (const [subId, file] of azBySubmissionId) {
    if (!wantedIds.has(subId)) deletionCandidates.push(file);
  }
  deletionCandidates.push(...azOrphans);
  const protect =
    azFiles.length > 0 && deletionCandidates.length / azFiles.length > MAX_DELETE_RATIO;
  summary.protectionTriggered = protect;

  let playlistId: number | null = null;

  // 2) Uppladdningar (saknade i AzuraCast)
  for (const track of tracks) {
    const az = azBySubmissionId.get(track.id);
    if (az) {
      // redan på AzuraCast — uppdatera DB om id-saknad
      if (track.azuracast_file_id !== az.id && !opts.dryRun) {
        await supabaseAdmin
          .from("submissions")
          .update({
            azuracast_file_id: az.id,
            azuracast_synced_at: new Date().toISOString(),
            azuracast_sync_error: null,
          })
          .eq("id", track.id);
      }
      summary.skipped.push({ submissionId: track.id, reason: "already_in_azuracast" });
      continue;
    }
    if (opts.dryRun) {
      summary.uploaded.push({ submissionId: track.id, azFileId: -1 });
      continue;
    }
    try {
      if (playlistId == null) playlistId = await getDefaultPlaylistId();
      const path = buildAzPath({
        id: track.id,
        title: track.title,
        artist_name: track.artist_name,
        audio_path: track.audio_web_path ?? track.audio_path,
      });
      const base64 = await fetchAudioAsBase64(track.audio_web_path ?? track.audio_path);
      const azFileId = await uploadToAzuracast({ path, base64 });
      await assignToPlaylist(azFileId, playlistId);
      await supabaseAdmin
        .from("submissions")
        .update({
          azuracast_file_id: azFileId,
          azuracast_synced_at: new Date().toISOString(),
          azuracast_sync_error: null,
        })
        .eq("id", track.id);
      summary.uploaded.push({ submissionId: track.id, azFileId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.failures.push({ submissionId: track.id, reason: msg });
      await supabaseAdmin
        .from("submissions")
        .update({ azuracast_sync_error: msg.slice(0, 500) })
        .eq("id", track.id)
        .then(() => undefined, () => undefined);
    }
  }

  // 3) Raderingar (i Synced_music men inte i katalogen) — skyddade av spärr
  if (!protect) {
    for (const file of deletionCandidates) {
      if (opts.dryRun) {
        summary.deleted.push({ azFileId: file.id, path: file.path });
        continue;
      }
      try {
        await deleteAzFile(file.id);
        summary.deleted.push({ azFileId: file.id, path: file.path });
        // nollställ azuracast_file_id om DB pekade hit
        await supabaseAdmin
          .from("submissions")
          .update({ azuracast_file_id: null })
          .eq("azuracast_file_id", file.id)
          .then(() => undefined, () => undefined);
      } catch (e) {
        summary.failures.push({
          azFileId: file.id,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return summary;
}