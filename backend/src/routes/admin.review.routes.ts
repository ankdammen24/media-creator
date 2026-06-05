import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { approveTrack, createDistributionCopies, createMaster, listReviewTracks, publishTrack, rejectTrack } from '../services/admin.service.js';

export const adminReviewRouter = Router();

const rejectionSchema = z.object({ reason: z.string().min(1).optional() });

adminReviewRouter.use('/admin', requireAuth, requireAdmin);

adminReviewRouter.get('/admin/review/tracks', async (req, res, next) => {
  try {
    res.json({ tracks: await listReviewTracks(String(req.query.status ?? 'submitted')) });
  } catch (error) {
    next(error);
  }
});

adminReviewRouter.post('/admin/review/tracks/:trackId/approve', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.json({ track: await approveTrack(req.user.id, req.params.trackId) });
  } catch (error) {
    next(error);
  }
});

adminReviewRouter.post('/admin/review/tracks/:trackId/reject', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const body = rejectionSchema.parse(req.body);
    res.json({ track: await rejectTrack(req.user.id, req.params.trackId, body.reason) });
  } catch (error) {
    next(error);
  }
});

adminReviewRouter.post('/admin/tracks/:trackId/master', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.status(201).json(await createMaster(req.user.id, req.params.trackId));
  } catch (error) {
    next(error);
  }
});

adminReviewRouter.post('/admin/tracks/:trackId/distribute', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.status(201).json(await createDistributionCopies(req.user.id, req.params.trackId));
  } catch (error) {
    next(error);
  }
});

adminReviewRouter.post('/admin/tracks/:trackId/publish', async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.json({ track: await publishTrack(req.user.id, req.params.trackId) });
  } catch (error) {
    next(error);
  }
});
