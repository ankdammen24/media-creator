import { pool } from '../config/db.js';

export type AuditAction =
  | 'upload_session_created'
  | 'upload_completed'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'metadata_updated'
  | 'submitted_for_review'
  | 'approved'
  | 'rejected'
  | 'master_created'
  | 'distribution_copy_created'
  | 'published';

interface AuditLogInput {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

export async function writeAuditLog({ userId, action, entityType, entityId, payload = {} }: AuditLogInput) {
  await pool.query(
    `insert into audit_log (user_id, action, entity_type, entity_id, payload)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [userId ?? null, action, entityType ?? null, entityId ?? null, JSON.stringify(payload)],
  );
}
