import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getTrackStatus, listCreatorTracks, submitTrack, updateTrackMetadata } from '../services/track.service.js';

export const creatorTracksRouter = Router();

const metadataSchema = z.object({
  title: z.string().min(1).optional(),
  artistId: z.string().uuid().nullable().optional(),
  albumId: z.string().uuid().nullable().optional(),
  isrc: z.string().min(1).nullable().optional(),
  upc: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

creatorTracksRouter.get('/creator/tracks', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.json({ tracks: await listCreatorTracks(req.user.id) });
  } catch (error) {
    next(error);
  }
});

creatorTracksRouter.get('/creator/tracks/:trackId/status', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.json(await getTrackStatus(req.user.id, req.params.trackId));
  } catch (error) {
    next(error);
  }
});

creatorTracksRouter.patch('/creator/tracks/:trackId/metadata', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const body = metadataSchema.parse(req.body);
    res.json({ track: await updateTrackMetadata(req.user.id, req.params.trackId, body) });
  } catch (error) {
    next(error);
  }
});

creatorTracksRouter.post('/creator/tracks/:trackId/submit', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    res.json({ track: await submitTrack(req.user.id, req.params.trackId) });
  } catch (error) {
    next(error);
  }
});
