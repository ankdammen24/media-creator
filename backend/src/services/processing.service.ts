import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pool } from '../config/db.js';
import { createNormalizedWav, createPreviewMp3, probeAudio } from './ffmpeg.service.js';
import { downloadObjectToFile, uploadFileToObject, uploadJsonObject } from './r2.service.js';

export async function processAudioJob(jobId: string) {
  const jobResult = await pool.query(
    `select j.*, f.r2_key, f.filename, f.content_type
     from processing_jobs j
     join track_files f on f.id = j.input_file_id
     where j.id = $1`,
    [jobId],
  );
  const job = jobResult.rows[0];
  if (!job) throw new Error(`Processing job not found: ${jobId}`);

  const workDir = await mkdtemp(path.join(os.tmpdir(), `media-creator-${job.track_id}-`));
  const originalPath = path.join(workDir, job.filename ?? 'original');
  const metadataPath = path.join(workDir, 'technical-metadata.json');
  const previewPath = path.join(workDir, 'preview.mp3');
  const normalizedPath = path.join(workDir, 'normalized.wav');

  try {
    await pool.query('update processing_jobs set status = $2, started_at = now(), updated_at = now() where id = $1', [jobId, 'running']);
    await pool.query('update tracks set status = $2, updated_at = now() where id = $1', [job.track_id, 'processing']);

    await downloadObjectToFile(job.r2_key, originalPath);
    const metadata = await probeAudio(originalPath);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    await createPreviewMp3(originalPath, previewPath);
    await createNormalizedWav(originalPath, normalizedPath);

    const metadataKey = `processing/${job.track_id}/technical-metadata.json`;
    const previewKey = `processing/${job.track_id}/preview.mp3`;
    const normalizedKey = `processing/${job.track_id}/normalized.wav`;

    await uploadJsonObject(metadataKey, metadata);
    await uploadFileToObject(previewKey, previewPath, 'audio/mpeg');
    await uploadFileToObject(normalizedKey, normalizedPath, 'audio/wav');

    await pool.query(
      `insert into track_files (track_id, file_type, filename, content_type, r2_key, status)
       values
        ($1, 'technical_metadata', 'technical-metadata.json', 'application/json', $2, 'generated'),
        ($1, 'preview', 'preview.mp3', 'audio/mpeg', $3, 'generated'),
        ($1, 'normalized', 'normalized.wav', 'audio/wav', $4, 'generated')`,
      [job.track_id, metadataKey, previewKey, normalizedKey],
    );

    await pool.query('update processing_jobs set status = $2, completed_at = now(), updated_at = now(), error_message = null where id = $1', [jobId, 'completed']);
    await pool.query('update tracks set status = $2, technical_metadata = $3::jsonb, updated_at = now() where id = $1', [job.track_id, 'processed', JSON.stringify(metadata)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing failure';
    await pool.query('update processing_jobs set status = $2, completed_at = now(), updated_at = now(), error_message = $3 where id = $1', [jobId, 'failed', message]);
    await pool.query('update tracks set status = $2, updated_at = now() where id = $1', [job.track_id, 'failed']);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
