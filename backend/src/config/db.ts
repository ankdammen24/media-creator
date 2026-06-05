import pg from 'pg';
import { env } from './env.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

export async function checkDatabaseConnection() {
  const result = await pool.query<{ ok: number }>('select 1 as ok');
  return result.rows[0]?.ok === 1;
}
