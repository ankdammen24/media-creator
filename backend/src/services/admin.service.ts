import { pool } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import { copyObject, uploadJsonObject } from './r2.service.js';
import { writeAuditLog } from './audit.service.js';

export async function listReviewTracks(status = 'submitted') {
  const result = await pool.query('select * from tracks where status = $1 order by updated_at asc', [status]);
  return result.rows;
}

export async function approveTrack(adminId: string, trackId: string) {
  const result = await pool.query(
    `update tracks set status = 'approved', updated_at = now()
     where id = $1 and status in ('submitted', 'reviewing') returning *`,
    [trackId],
  );
  if (!result.rowCount) throw new AppError(400, 'Track must be submitted or reviewing before approval');

  await writeAuditLog({ userId: adminId, action: 'approved', entityType: 'track', entityId: trackId });
  return result.rows[0];
}

export async function rejectTrack(adminId: string, trackId: string, reason?: string) {
  const result = await pool.query(
    `update tracks
     set status = 'rejected', metadata = metadata || $2::jsonb, updated_at = now()
     where id = $1 and status in ('submitted', 'reviewing') returning *`,
    [trackId, JSON.stringify({ rejectionReason: reason ?? null })],
  );
  if (!result.rowCount) throw new AppError(400, 'Track must be submitted or reviewing before rejection');

  await writeAuditLog({ userId: adminId, action: 'rejected', entityType: 'track', entityId: trackId, payload: { reason } });
  return result.rows[0];
}

export async function createMaster(adminId: string, trackId: string) {
  const existingMaster = await pool.query('select 1 from track_files where track_id = $1 and file_type = $2', [trackId, 'master']);
  if (existingMaster.rowCount) throw new AppError(409, 'Master already exists for this track');

  const track = await pool.query('select * from tracks where id = $1 and status = $2', [trackId, 'approved']);
  if (!track.rowCount) throw new AppError(400, 'Track must be approved before master creation');

  const normalized = await pool.query(
    `select * from track_files where track_id = $1 and file_type = 'normalized' and status = 'generated' order by created_at desc limit 1`,
    [trackId],
  );
  if (!normalized.rowCount) throw new AppError(400, 'Normalized processing file is required before master creation');

  const masterKey = `masters/${trackId}/master.wav`;
  await copyObject(normalized.rows[0].r2_key, masterKey, 'audio/wav');

  const master = await pool.query(
    `insert into track_files (track_id, file_type, filename, content_type, r2_key, status)
     values ($1, 'master', 'master.wav', 'audio/wav', $2, 'generated') returning *`,
    [trackId, masterKey],
  );
  const updatedTrack = await pool.query(`update tracks set status = 'mastered', updated_at = now() where id = $1 returning *`, [trackId]);

  await writeAuditLog({ userId: adminId, action: 'master_created', entityType: 'track', entityId: trackId, payload: { masterKey } });
  return { track: updatedTrack.rows[0], masterFile: master.rows[0] };
}

export async function createDistributionCopies(adminId: string, trackId: string) {
  const existingDistribution = await pool.query(
    `select 1 from track_files where track_id = $1 and file_type in ('distribution_master', 'distribution_preview') limit 1`,
    [trackId],
  );
  if (existingDistribution.rowCount) throw new AppError(409, 'Distribution files already exist for this track');

  const track = await pool.query('select * from tracks where id = $1 and status = $2', [trackId, 'mastered']);
  if (!track.rowCount) throw new AppError(400, 'Track must be mastered before distribution copy creation');

  const files = await pool.query(
    `select * from track_files where track_id = $1 and file_type in ('master', 'preview') order by created_at desc`,
    [trackId],
  );
  const master = files.rows.find((file) => file.file_type === 'master');
  const preview = files.rows.find((file) => file.file_type === 'preview');
  if (!master || !preview) throw new AppError(400, 'Master and preview files are required before distribution');

  const distributionMasterKey = `distribution/${trackId}/master.wav`;
  const distributionPreviewKey = `distribution/${trackId}/preview.mp3`;
  const distributionMetadataKey = `distribution/${trackId}/metadata.json`;

  await copyObject(master.r2_key, distributionMasterKey, 'audio/wav');
  await copyObject(preview.r2_key, distributionPreviewKey, 'audio/mpeg');
  await uploadJsonObject(distributionMetadataKey, { track: track.rows[0] });

  const distributionFiles = await pool.query(
    `insert into track_files (track_id, file_type, filename, content_type, r2_key, status)
     values
      ($1, 'distribution_master', 'master.wav', 'audio/wav', $2, 'generated'),
      ($1, 'distribution_preview', 'preview.mp3', 'audio/mpeg', $3, 'generated')
     returning *`,
    [trackId, distributionMasterKey, distributionPreviewKey],
  );
  const updatedTrack = await pool.query(`update tracks set status = 'distributed', updated_at = now() where id = $1 returning *`, [trackId]);

  await writeAuditLog({
    userId: adminId,
    action: 'distribution_copy_created',
    entityType: 'track',
    entityId: trackId,
    payload: { distributionMasterKey, distributionPreviewKey, distributionMetadataKey },
  });

  return { track: updatedTrack.rows[0], distributionFiles: distributionFiles.rows };
}

export async function publishTrack(adminId: string, trackId: string) {
  const result = await pool.query(
    `update tracks set status = 'published', updated_at = now()
     where id = $1 and status = 'distributed' returning *`,
    [trackId],
  );
  if (!result.rowCount) throw new AppError(400, 'Track must be distributed before publishing');

  await writeAuditLog({ userId: adminId, action: 'published', entityType: 'track', entityId: trackId });
  return result.rows[0];
}
