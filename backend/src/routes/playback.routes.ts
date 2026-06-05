import { Router } from 'express';
import { getPublishedDistributionFile } from '../services/catalog.service.js';
import { createPresignedDownloadUrl } from '../services/r2.service.js';

export const playbackRouter = Router();

playbackRouter.get('/playback/tracks/:trackId/preview-url', async (req, res, next) => {
  try {
    const file = await getPublishedDistributionFile(req.params.trackId, 'distribution_preview');
    res.json({ url: await createPresignedDownloadUrl(file.r2_key), expiresIn: 300 });
  } catch (error) {
    next(error);
  }
});

playbackRouter.get('/playback/tracks/:trackId/download-url', async (req, res, next) => {
  try {
    const file = await getPublishedDistributionFile(req.params.trackId, 'distribution_master');
    res.json({ url: await createPresignedDownloadUrl(file.r2_key), expiresIn: 300 });
  } catch (error) {
    next(error);
  }
});
