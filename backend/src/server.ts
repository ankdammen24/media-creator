import { env } from './config/env.js';
import { pool } from './config/db.js';
import { createApp } from './app.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`media-creator-backend listening on :${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
