/**
 * Seed integrity smoke test. Creates a throwaway session, seeds it, and asserts:
 *  - the expected row counts per table
 *  - the seeded journal entries are balanced (Σ debit cents === Σ credit cents)
 *  - resetSession() wipes and re-seeds to the same state
 * Cleans up the throwaway session at the end (FK cascade removes all its rows).
 *
 * Run: `npm run smoke`
 */
import { pool, query, queryOne } from '../db/pool';
import { sessionRepo } from '../repositories/sessionRepo';
import { seedSession, resetSession } from '../db/seed';

const EXPECTED = { accounts: 7, categories: 6, income_sources: 4, shortcuts: 4, journal_entries: 5 };

async function counts(sid: string) {
  const out: Record<string, number> = {};
  for (const table of Object.keys(EXPECTED)) {
    const row = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE session_id = $1`,
      [sid],
    );
    out[table] = Number(row?.n ?? 0);
  }
  return out;
}

async function balance(sid: string) {
  const row = await queryOne<{ debit: string; credit: string }>(
    `SELECT
       COALESCE(SUM(amount_cents) FILTER (WHERE side = 'debit'), 0)  AS debit,
       COALESCE(SUM(amount_cents) FILTER (WHERE side = 'credit'), 0) AS credit
     FROM journal_lines WHERE session_id = $1`,
    [sid],
  );
  return { debit: Number(row?.debit ?? 0), credit: Number(row?.credit ?? 0) };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  const sid = `smoke-${Date.now()}`;
  console.log(`[smoke] session ${sid}`);
  try {
    await sessionRepo.create(sid);
    await seedSession(sid);

    console.log('[smoke] after seedSession:');
    const c1 = await counts(sid);
    for (const [t, n] of Object.entries(EXPECTED)) assert(c1[t] === n, `${t} = ${n} (got ${c1[t]})`);
    const b1 = await balance(sid);
    assert(b1.debit === b1.credit, `entries balanced: debit ${b1.debit} === credit ${b1.credit}`);
    assert(b1.debit > 0, `entries have non-zero volume (${b1.debit} cents)`);

    console.log('[smoke] after resetSession:');
    await resetSession(sid);
    const c2 = await counts(sid);
    for (const [t, n] of Object.entries(EXPECTED)) assert(c2[t] === n, `${t} = ${n} after reset (got ${c2[t]})`);
    const b2 = await balance(sid);
    assert(b2.debit === b2.credit, `still balanced after reset: ${b2.debit} === ${b2.credit}`);

    console.log('\n[smoke] PASS');
  } finally {
    await query('DELETE FROM sessions WHERE session_id = $1', [sid]); // cascade cleans everything
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n[smoke] FAIL:', err.message);
  process.exit(1);
});
