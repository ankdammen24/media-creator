// Server-only helpers for the EBU R128 / two-format audio processing pipeline.
// Never import this file from client code. The transcoding itself runs on a
// separate ffmpeg worker (see /worker) — this module only enqueues jobs and
// signs URLs.
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AUDIO_BUCKET = "audio";

export type LogLevel = "info" | "warn" | "error";

/**
 * Append an entry to the admin-only audio_processing_logs table. Best-effort —
 * logging failures must never break the main processing flow.
 */
export async function logAudio(
  event: string,
  message: string,
  opts?: {
    submissionId?: string | null;
    level?: LogLevel;
    payload?: Record<string, unknown>;
    createdBy?: string | null;
  },
) {
  try {
    await supabaseAdmin.from("audio_processing_logs").insert({
      event,
      message: message.slice(0, 2000),
      level: opts?.level ?? "info",
      submission_id: opts?.submissionId ?? null,
      payload: (opts?.payload ?? {}) as never,
      created_by: opts?.createdBy ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("audio log failed", e);
  }
}

export type EmbedMetadata = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  track_number?: string | null;
  release_date?: string | null;
  genre?: string | null;
  isrc?: string | null;
  upc?: string | null;
  comment?: string | null;
};

export type WorkerJob = {
  submissionId: string;
  ownerId: string;
  storageProvider: "supabase";
  downloadUrl: string;
  masterPath: string;
  webPath: string;
  callbackUrl: string;
  metadata: EmbedMetadata;
  loudnorm: { i: number; tp: number; lra: number };
  force?: boolean;
};

export function buildOutputPaths(ownerId: string, submissionId: string) {
  return {
    masterPath: `${ownerId}/master/${submissionId}.flac`,
    webPath: `${ownerId}/web/${submissionId}.m4a`,
  };
}

export function hmacSign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function buildEmbedMetadata(submissionId: string): Promise<{
  embed: EmbedMetadata;
  ownerId: string;
  sourcePath: string;
  status: "pending" | "processing" | "done" | "failed" | "skipped";
}> {
  const { data: sub, error } = await supabaseAdmin
    .from("submissions")
    .select(
      "id, user_id, title, audio_path, isrc, processing_status, artist_profile_id, album_id, track_number, artist_profiles!submissions_artist_profile_id_fkey(name), albums(title, upc, genre, release_date)",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(`load submission: ${error.message}`);
  if (!sub) throw new Error(`submission ${submissionId} not found`);
  if (!sub.audio_path) throw new Error(`submission ${submissionId} has no audio_path`);

  const artistRel = (sub as { artist_profiles?: { name?: string } | null }).artist_profiles;
  const albumRel = (sub as { albums?: { title?: string; upc?: string | null; genre?: string | null; release_date?: string | null } | null }).albums;

  return {
    embed: {
      title: sub.title,
      artist: artistRel?.name ?? null,
      album_artist: artistRel?.name ?? null,
      album: albumRel?.title ?? null,
      track_number: sub.track_number != null ? String(sub.track_number) : null,
      release_date: albumRel?.release_date ?? null,
      genre: albumRel?.genre ?? null,
      isrc: sub.isrc ?? null,
      upc: albumRel?.upc ?? null,
    },
    ownerId: sub.user_id,
    sourcePath: sub.audio_path,
    status: (sub.processing_status as WorkerJob["force"] extends never ? never : "pending" | "processing" | "done" | "failed" | "skipped") ?? "pending",
  };
}

/**
 * Hands off a single submission to the ffmpeg worker. Returns:
 *  - "queued": worker accepted the job (returns 202)
 *  - "skipped": worker has no URL configured (dev / not yet deployed)
 *  - "failed": worker rejected the job (status persisted as 'failed')
 */
export async function dispatchToWorker(submissionId: string, opts?: { force?: boolean }) {
  const url = process.env.AUDIO_PROCESSOR_URL;
  const secret = process.env.AUDIO_PROCESSOR_SECRET;
  if (!url || !secret) {
    // Worker not configured yet — mark as pending so we can backfill later.
    await supabaseAdmin
      .from("submissions")
      .update({ processing_status: "pending", processing_error: "AUDIO_PROCESSOR_URL not configured" })
      .eq("id", submissionId);
    await logAudio("skipped", "Worker URL ej konfigurerad — markerad pending.", {
      submissionId,
      level: "warn",
    });
    return { outcome: "skipped" as const, reason: "worker not configured" };
  }

  const { embed, ownerId, sourcePath } = await buildEmbedMetadata(submissionId);
  const { masterPath, webPath } = buildOutputPaths(ownerId, submissionId);

  // 1 h signed download URL for the worker to pull the original file.
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(sourcePath, 60 * 60);
  if (signErr || !signed) {
    throw new Error(`sign source: ${signErr?.message ?? "unknown"}`);
  }

  // Callback URL = same origin as the app. Worker reaches it via the stable
  // project URL configured in env, or falls back to the request host.
  const appUrl = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "";
  const callbackUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/api/public/hooks/audio-processed`
    : `/api/public/hooks/audio-processed`;

  const job: WorkerJob = {
    submissionId,
    ownerId,
    storageProvider: "supabase",
    downloadUrl: signed.signedUrl,
    masterPath,
    webPath,
    callbackUrl,
    metadata: embed,
    loudnorm: { i: -23, tp: -1, lra: 11 },
    force: opts?.force,
  };
  const body = JSON.stringify(job);
  const signature = hmacSign(secret, body);

  // Mark as processing before dispatch so the UI reflects state immediately.
  await supabaseAdmin
    .from("submissions")
    .update({ processing_status: "processing", processing_error: null })
    .eq("id", submissionId);
  await logAudio("dispatch", `Skickar jobb till worker (force=${!!opts?.force}).`, {
    submissionId,
    payload: { masterPath, webPath, force: !!opts?.force },
  });

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": signature },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = `worker ${res.status}: ${text.slice(0, 200)}`;
      await supabaseAdmin
        .from("submissions")
        .update({ processing_status: "failed", processing_error: msg })
        .eq("id", submissionId);
      await logAudio("dispatch_failed", msg, {
        submissionId,
        level: "error",
        payload: { httpStatus: res.status },
      });
      return { outcome: "failed" as const, reason: msg };
    }
    await logAudio("queued", "Worker accepterade jobbet.", { submissionId });
    return { outcome: "queued" as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("submissions")
      .update({ processing_status: "failed", processing_error: `dispatch: ${msg}` })
      .eq("id", submissionId);
    await logAudio("dispatch_error", `dispatch: ${msg}`, {
      submissionId,
      level: "error",
    });
    return { outcome: "failed" as const, reason: msg };
  }
}