/**
 * Idempotent schema migration. Reads schema.sql (all CREATE ... IF NOT EXISTS) and runs
 * it against DATABASE_URL. Safe to re-run. Invoke with `npm run migrate`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './pool';

async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  console.log('[migrate] applying schema.sql ...');
  await pool.query(sql);
  console.log('[migrate] done.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
