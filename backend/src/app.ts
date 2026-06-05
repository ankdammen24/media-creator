import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { creatorTracksRouter } from './routes/creator.tracks.routes.js';
import { creatorUploadsRouter } from './routes/creator.uploads.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { processingRouter } from './routes/processing.routes.js';
import { adminReviewRouter } from './routes/admin.review.routes.js';
import { publicCatalogRouter } from './routes/public.catalog.routes.js';
import { playbackRouter } from './routes/playback.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(creatorUploadsRouter);
  app.use(creatorTracksRouter);
  app.use(processingRouter);
  app.use(adminReviewRouter);
  app.use(publicCatalogRouter);
  app.use(playbackRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
