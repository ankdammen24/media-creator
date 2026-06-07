// Direct-to-R2 upload helpers for the Creator app.
// 1) Asks the `r2-presign` edge function for presigned PUT URLs.
// 2) Uploads audio + cover directly to Cloudflare R2 via XHR (with progress).
// 3) Inserts media_files + submissions rows in the database.

import { supabase } from "@/integrations/supabase/client";

export const AUDIO_MIME = new Set([
  "audio/wav",
  "audio/mpeg",
  "audio/flac",
  "audio/aiff",
  "audio/x-aiff",
  "audio/x-wav",
]);
export const COVER_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_COVER_BYTES = 10 * 1024 * 1024; //  10 MB

export const AUDIO_ACCEPT =
  "audio/wav,audio/mpeg,audio/flac,audio/aiff,audio/x-aiff";
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const e = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** e).toFixed(e === 0 ? 0 : 1)} ${units[e]}`;
}

export function validateAudio(file: File): string | null {
  if (!AUDIO_MIME.has(file.type)) return `Unsupported audio type: ${file.type || "unknown"}`;
  if (file.size > MAX_AUDIO_BYTES) return `Audio is too large. Max ${formatBytes(MAX_AUDIO_BYTES)}.`;
  return null;
}

export function validateCover(file: File): string | null {
  if (!COVER_MIME.has(file.type)) return `Unsupported image type: ${file.type || "unknown"}`;
  if (file.size > MAX_COVER_BYTES) return `Cover art is too large. Max ${formatBytes(MAX_COVER_BYTES)}.`;
  return null;
}

type PresignResponse = {
  uploadUrl: string;
  key: string;
  bucket: string;
  publicUrl: string | null;
};

async function presign(kind: "audio" | "cover", file: File): Promise<PresignResponse> {
  const { data, error } = await supabase.functions.invoke<PresignResponse>("r2-presign", {
    body: {
      kind,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    },
  });
  if (error || !data) {
    throw new Error(`Could not get upload URL: ${error?.message ?? "unknown error"}`);
  }
  return data;
}

function putToR2(uploadUrl: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`R2 upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export type CreateSubmissionInput = {
  userId: string;
  artistProfileId: string;
  title: string;
  mediaType?: "music" | "podcast";
  description?: string | null;
  audioFile: File;
  coverFile: File;
  albumId?: string | null;
  onAudioProgress?: (pct: number) => void;
  onCoverProgress?: (pct: number) => void;
};

export type CreateSubmissionResult = {
  submissionId: string;
  audioPath: string;
  artworkPath: string;
};

export async function uploadAndCreateSubmission(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult> {
  const audioErr = validateAudio(input.audioFile);
  if (audioErr) throw new Error(audioErr);
  const coverErr = validateCover(input.coverFile);
  if (coverErr) throw new Error(coverErr);
  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.artistProfileId) throw new Error("Please choose an artist");

  // 1. Presign both URLs in parallel
  const [audioPresign, coverPresign] = await Promise.all([
    presign("audio", input.audioFile),
    presign("cover", input.coverFile),
  ]);

  // 2. Upload audio + cover to R2 in parallel
  await Promise.all([
    putToR2(audioPresign.uploadUrl, input.audioFile, input.onAudioProgress),
    putToR2(coverPresign.uploadUrl, input.coverFile, input.onCoverProgress),
  ]);

  // 3. Create submission row
  const submissionInsert = await supabase
    .from("submissions")
    .insert({
      user_id: input.userId,
      artist_profile_id: input.artistProfileId,
      album_id: input.albumId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      media_type: input.mediaType ?? "music",
      audio_path: audioPresign.key,
      artwork_path: coverPresign.key,
    })
    .select("id")
    .single();

  if (submissionInsert.error || !submissionInsert.data) {
    throw new Error(
      `Could not create submission: ${submissionInsert.error?.message ?? "unknown error"}`,
    );
  }

  const submissionId = submissionInsert.data.id as string;

  // 4. Record both files in media_files (best-effort)
  await supabase.from("media_files").insert([
    {
      owner_id: input.userId,
      bucket: audioPresign.bucket,
      path: audioPresign.key,
      storage_key: audioPresign.key,
      kind: "audio_original",
      file_type: "audio_original",
      mime_type: input.audioFile.type,
      size_bytes: input.audioFile.size,
      original_filename: input.audioFile.name,
      submission_id: submissionId,
      album_id: input.albumId ?? null,
      artist_profile_id: input.artistProfileId,
    },
    {
      owner_id: input.userId,
      bucket: coverPresign.bucket,
      path: coverPresign.key,
      storage_key: coverPresign.key,
      kind: "cover_art",
      file_type: "cover_art",
      mime_type: input.coverFile.type,
      size_bytes: input.coverFile.size,
      original_filename: input.coverFile.name,
      submission_id: submissionId,
      album_id: input.albumId ?? null,
      artist_profile_id: input.artistProfileId,
    },
  ]);

  return {
    submissionId,
    audioPath: audioPresign.key,
    artworkPath: coverPresign.key,
  };
}
