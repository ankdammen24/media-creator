// Direct-to-Supabase upload helpers for the Creator app.
// Writes audio to `audio-originals/<user_id>/...` and cover art to `cover-art/<user_id>/...`,
// records each file in `media_files`, and creates a `submissions` row.

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

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function ownedPath(userId: string, file: File) {
  return `${userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
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
};

export type CreateSubmissionResult = {
  submissionId: string;
  audioPath: string;
  artworkPath: string;
};

/**
 * Uploads the audio + cover art to the shared Supabase buckets and creates a
 * submission row plus matching media_files rows. RLS enforces that:
 *  - files are written under `<user_id>/...`
 *  - the user owns the chosen artist_profile
 */
export async function uploadAndCreateSubmission(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionResult> {
  const audioErr = validateAudio(input.audioFile);
  if (audioErr) throw new Error(audioErr);
  const coverErr = validateCover(input.coverFile);
  if (coverErr) throw new Error(coverErr);
  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.artistProfileId) throw new Error("Please choose an artist");

  const audioPath = ownedPath(input.userId, input.audioFile);
  const coverPath = ownedPath(input.userId, input.coverFile);

  // 1. Upload audio (private bucket)
  const audioUp = await supabase.storage
    .from("audio-originals")
    .upload(audioPath, input.audioFile, {
      contentType: input.audioFile.type,
      upsert: false,
    });
  if (audioUp.error) throw new Error(`Audio upload failed: ${audioUp.error.message}`);

  // 2. Upload cover (private bucket; anon-readable via RLS)
  const coverUp = await supabase.storage
    .from("cover-art")
    .upload(coverPath, input.coverFile, {
      contentType: input.coverFile.type,
      upsert: false,
    });
  if (coverUp.error) {
    // best-effort rollback of audio
    await supabase.storage.from("audio-originals").remove([audioPath]);
    throw new Error(`Cover upload failed: ${coverUp.error.message}`);
  }

  // 3. Create submission row (status defaults to 'pending_review')
  const submissionInsert = await supabase
    .from("submissions")
    .insert({
      user_id: input.userId,
      artist_profile_id: input.artistProfileId,
      album_id: input.albumId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      media_type: input.mediaType ?? "music",
      audio_path: audioPath,
      artwork_path: coverPath,
    })
    .select("id")
    .single();

  if (submissionInsert.error || !submissionInsert.data) {
    await supabase.storage.from("audio-originals").remove([audioPath]);
    await supabase.storage.from("cover-art").remove([coverPath]);
    throw new Error(
      `Could not create submission: ${submissionInsert.error?.message ?? "unknown error"}`,
    );
  }

  const submissionId = submissionInsert.data.id as string;

  // 4. Record both files in media_files (best-effort; submission already exists)
  await supabase.from("media_files").insert([
    {
      owner_id: input.userId,
      bucket: "audio-originals",
      path: audioPath,
      kind: "audio_original",
      mime_type: input.audioFile.type,
      size_bytes: input.audioFile.size,
      submission_id: submissionId,
      album_id: input.albumId ?? null,
      artist_profile_id: input.artistProfileId,
    },
    {
      owner_id: input.userId,
      bucket: "cover-art",
      path: coverPath,
      kind: "cover_art",
      mime_type: input.coverFile.type,
      size_bytes: input.coverFile.size,
      submission_id: submissionId,
      album_id: input.albumId ?? null,
      artist_profile_id: input.artistProfileId,
    },
  ]);

  return { submissionId, audioPath, artworkPath: coverPath };
}
