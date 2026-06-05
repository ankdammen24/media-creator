import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';

export const processingRouter = Router();

processingRouter.get('/processing/jobs/:jobId', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const result = await pool.query(
      `select j.* from processing_jobs j join tracks t on t.id = j.track_id where j.id = $1 and t.creator_id = $2`,
      [req.params.jobId, req.user.id],
    );
    if (!result.rowCount) throw new AppError(404, 'Processing job not found');
    res.json({ processingJob: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
