import { Router } from 'express';
import { getPublishedTrack, listPublishedTracks } from '../services/catalog.service.js';

export const publicCatalogRouter = Router();

publicCatalogRouter.get('/catalog/tracks', async (_req, res, next) => {
  try {
    res.json({ tracks: await listPublishedTracks() });
  } catch (error) {
    next(error);
  }
});

publicCatalogRouter.get('/catalog/tracks/:trackId', async (req, res, next) => {
  try {
    res.json({ track: await getPublishedTrack(req.params.trackId) });
  } catch (error) {
    next(error);
  }
});
