import { pool } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listCreatorTracks(creatorId: string) {
  const result = await pool.query('select * from tracks where creator_id = $1 order by created_at desc', [creatorId]);
  return result.rows;
}

export async function getTrackStatus(creatorId: string, trackId: string) {
  const track = await pool.query('select * from tracks where id = $1 and creator_id = $2', [trackId, creatorId]);
  if (!track.rowCount) throw new AppError(404, 'Track not found');

  const [files, jobs] = await Promise.all([
    pool.query('select * from track_files where track_id = $1 order by created_at asc', [trackId]),
    pool.query('select * from processing_jobs where track_id = $1 order by created_at desc', [trackId]),
  ]);

  return { track: track.rows[0], files: files.rows, processingJobs: jobs.rows };
}

export async function updateTrackMetadata(creatorId: string, trackId: string, metadata: Record<string, unknown>) {
  const result = await pool.query(
    `update tracks set
      title = coalesce($3, title),
      artist_id = coalesce($4, artist_id),
      album_id = coalesce($5, album_id),
      isrc = coalesce($6, isrc),
      upc = coalesce($7, upc),
      metadata = metadata || coalesce($8::jsonb, '{}'::jsonb),
      updated_at = now()
    where id = $1 and creator_id = $2
    returning *`,
    [trackId, creatorId, metadata.title, metadata.artistId, metadata.albumId, metadata.isrc, metadata.upc, JSON.stringify(metadata.metadata ?? {})],
  );

  if (!result.rowCount) throw new AppError(404, 'Track not found');
  return result.rows[0];
}

export async function submitTrack(creatorId: string, trackId: string) {
  const result = await pool.query(
    `update tracks
     set status = 'submitted', updated_at = now()
     where id = $1 and creator_id = $2 and status = 'processed' and title is not null
     returning *`,
    [trackId, creatorId],
  );

  if (!result.rowCount) {
    throw new AppError(400, 'Track must be processed and include required metadata before submission');
  }

  return result.rows[0];
}
