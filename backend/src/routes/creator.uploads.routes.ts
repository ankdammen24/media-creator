import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { completeUpload, createUploadSession, uploadCompleteSchema, uploadSessionSchema } from '../services/upload.service.js';

export const creatorUploadsRouter = Router();

creatorUploadsRouter.post('/creator/uploads/session', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const body = uploadSessionSchema.parse(req.body);
    const uploads = await createUploadSession(req.user.id, body.files);
    res.status(201).json({ uploads });
  } catch (error) {
    next(error);
  }
});

creatorUploadsRouter.post('/creator/uploads/complete', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const body = uploadCompleteSchema.parse(req.body);
    const result = await completeUpload(req.user.id, body.trackId, body.fileId, body.r2Key);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
