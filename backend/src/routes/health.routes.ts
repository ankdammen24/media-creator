import { Router } from 'express';
import { checkDatabaseConnection } from '../config/db.js';
import { checkStorageConnection } from '../services/r2.service.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'media-creator-backend' });
});

healthRouter.get('/health/database', async (_req, res, next) => {
  try {
    res.json({ status: (await checkDatabaseConnection()) ? 'ok' : 'unavailable' });
  } catch (error) {
    next(error);
  }
});

healthRouter.get('/health/storage', async (_req, res, next) => {
  try {
    await checkStorageConnection();
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});
