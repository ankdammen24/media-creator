import { pool } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

const publicTrackSelect = `
  select id, title, artist_id, album_id, isrc, upc, metadata, technical_metadata, created_at, updated_at
  from tracks
`;

export async function listPublishedTracks() {
  const result = await pool.query(`${publicTrackSelect} where status = 'published' order by updated_at desc`);
  return result.rows;
}

export async function getPublishedTrack(trackId: string) {
  const result = await pool.query(`${publicTrackSelect} where id = $1 and status = 'published'`, [trackId]);
  if (!result.rowCount) throw new AppError(404, 'Published track not found');
  return result.rows[0];
}

export async function getPublishedDistributionFile(trackId: string, fileType: 'distribution_preview' | 'distribution_master') {
  const result = await pool.query(
    `select f.*
     from track_files f
     join tracks t on t.id = f.track_id
     where t.id = $1 and t.status = 'published' and f.file_type = $2 and f.status = 'generated'
     order by f.created_at desc
     limit 1`,
    [trackId, fileType],
  );
  if (!result.rowCount) throw new AppError(404, 'Published file not found');
  return result.rows[0];
}
