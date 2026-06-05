import path from 'node:path';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { createPresignedUploadUrl } from './r2.service.js';
import { enqueueAudioJob } from '../workers/audio.worker.js';
import { writeAuditLog } from './audit.service.js';

export const allowedAudioContentTypes = ['audio/wav', 'audio/mpeg', 'audio/flac', 'audio/aiff', 'audio/x-aiff'] as const;

export const uploadSessionSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1),
    contentType: z.enum(allowedAudioContentTypes),
    size: z.number().int().positive(),
  })).min(1).max(20),
});

export const uploadCompleteSchema = z.object({
  trackId: z.string().uuid(),
  fileId: z.string().uuid(),
  r2Key: z.string().min(1),
});

function extensionFor(filename: string, contentType: string) {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  if (ext) return ext;
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'audio/flac') return 'flac';
  if (contentType === 'audio/aiff' || contentType === 'audio/x-aiff') return 'aiff';
  return 'wav';
}

export async function createUploadSession(creatorId: string, files: z.infer<typeof uploadSessionSchema>['files']) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`insert into users (id, role) values ($1, 'creator') on conflict (id) do nothing`, [creatorId]);
    const uploads = [];

    for (const file of files) {
      const track = await client.query(
        `insert into tracks (creator_id, title, status) values ($1, $2, 'uploading') returning *`,
        [creatorId, path.parse(file.filename).name],
      );
      const trackId = track.rows[0].id as string;
      const r2Key = `uploads/${creatorId}/${trackId}/original.${extensionFor(file.filename, file.contentType)}`;
      const fileRow = await client.query(
        `insert into track_files (track_id, file_type, filename, content_type, size_bytes, r2_key, status)
         values ($1, 'original', $2, $3, $4, $5, 'pending_upload') returning *`,
        [trackId, file.filename, file.contentType, file.size, r2Key],
      );

      uploads.push({
        trackId,
        fileId: fileRow.rows[0].id,
        uploadUrl: await createPresignedUploadUrl(r2Key, file.contentType),
        r2Key,
      });
    }

    await client.query('commit');
    await writeAuditLog({
      userId: creatorId,
      action: 'upload_session_created',
      entityType: 'upload_session',
      payload: { trackIds: uploads.map((upload) => upload.trackId), fileCount: uploads.length },
    });
    return uploads;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeUpload(creatorId: string, trackId: string, fileId: string, r2Key: string) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const file = await client.query(
      `update track_files set status = 'uploaded', uploaded_at = now(), updated_at = now()
       where id = $1 and track_id = $2 and r2_key = $3 and file_type = 'original' and status = 'pending_upload'
       returning *`,
      [fileId, trackId, r2Key],
    );
    if (!file.rowCount) throw new AppError(404, 'Original file not found');

    const track = await client.query(
      `update tracks set status = 'uploaded', updated_at = now()
       where id = $1 and creator_id = $2 returning *`,
      [trackId, creatorId],
    );
    if (!track.rowCount) throw new AppError(404, 'Track not found');

    const job = await client.query(
      `insert into processing_jobs (track_id, status, input_file_id) values ($1, 'queued', $2) returning *`,
      [trackId, fileId],
    );

    await client.query('commit');
    await writeAuditLog({
      userId: creatorId,
      action: 'upload_completed',
      entityType: 'track',
      entityId: trackId,
      payload: { fileId, r2Key, jobId: job.rows[0].id },
    });
    enqueueAudioJob(job.rows[0].id);
    return { track: track.rows[0], file: file.rows[0], processingJob: job.rows[0] };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
