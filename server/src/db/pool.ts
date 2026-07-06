import { Pool, types, type PoolClient } from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

// pg returns BIGINT (int8, oid 20) as a string by default. All our money is integer
// cents and stays well within Number.MAX_SAFE_INTEGER, so parse int8 → number globally.
types.setTypeParser(20, (v) => parseInt(v, 10));

// Load server/.env explicitly relative to this file, so it works regardless of the
// process cwd (npm workspace scripts, tsx, and compiled dist all resolve the same file).
// dev: <server>/src/db/pool.ts → ../../.env ; prod: <server>/dist/db/pool.js → ../../.env
dotenv.config({ path: resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Not fatal at import time — lets `tsc`/tests run without a DB — but every query will throw.
  console.warn('[db] DATABASE_URL is not set. Configure it before serving requests.');
}

/**
 * Single module-level pool. Neon (and any managed PG) requires SSL; we disable strict
 * cert verification because the platform terminates TLS with its own chain. Keep `max`
 * small — the free tier caps connections and serverless bursts open many short-lived ones.
 */
export const pool = new Pool({
  connectionString,
  ssl:
    process.env.PGSSL === 'disable'
      ? undefined
      : { rejectUnauthorized: false },
  max: 5,
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Run `fn` inside a BEGIN/COMMIT transaction, rolling back on any thrown error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
