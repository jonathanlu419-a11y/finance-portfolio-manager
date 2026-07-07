/**
 * HTTP e2e smoke against a locally-running server (npm run dev). Uses Node fetch and
 * manual cookie handling — no shell pipes. Verifies fresh-session auto-seed, Settings
 * CRUD, and the 409 referenced-account delete guard. Run: `npm run e2e` (server must be up).
 */
import { SEED_COUNTS, SEED_ACCOUNT_NATURES, seedExpectedBalances } from '../db/seed';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3001';
let cookie = '';
const N_ENTRIES = SEED_COUNTS.journal_entries;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const sid = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('sid='));
  if (sid) cookie = sid;
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  console.log('[e2e] fresh visitor bootstrap');
  const sess = await call('GET', '/api/session');
  assert(sess.status === 200 && sess.body.ok === true, 'GET /api/session → 200 ok');
  assert(cookie.startsWith('sid='), 'session cookie captured');

  console.log('[e2e] auto-seeded counts (from the exported seed manifest)');
  const accounts = await call('GET', '/api/accounts');
  assert(accounts.body.length === SEED_COUNTS.accounts, `accounts = ${SEED_COUNTS.accounts} (got ${accounts.body.length})`);
  for (const [e, n] of [
    ['categories', SEED_COUNTS.categories],
    ['income-sources', SEED_COUNTS.income_sources],
    ['shortcuts', SEED_COUNTS.shortcuts],
  ] as const) {
    const r = await call('GET', `/api/${e}`);
    assert(r.body.length === n, `${e} = ${n} (got ${r.body.length})`);
  }

  console.log('[e2e] 409 referenced-account delete guard');
  const chequing = accounts.body.find((a: { name: string }) => a.name === 'Chequing');
  const delRef = await call('DELETE', `/api/accounts/${chequing.id}`);
  assert(delRef.status === 409, `delete referenced Chequing → 409 (got ${delRef.status})`);
  assert(/cannot be deleted/i.test(delRef.body.error), 'friendly error message returned');

  console.log('[e2e] create / update / delete lifecycle');
  const created = await call('POST', '/api/accounts', { name: 'Scratch', nature: 'Expense', starting_balance_cents: 0 });
  assert(created.status === 201 && created.body.id > 0, 'create → 201 with id');
  const updated = await call('PUT', `/api/accounts/${created.body.id}`, { name: 'Scratch2', nature: 'Expense', starting_balance_cents: 500 });
  assert(updated.body.name === 'Scratch2' && updated.body.starting_balance_cents === 500, 'update persisted');
  const delOk = await call('DELETE', `/api/accounts/${created.body.id}`);
  assert(delOk.status === 200 && delOk.body.ok === true, 'delete unreferenced → 200 ok');

  console.log('[e2e] validation');
  const bad = await call('POST', '/api/accounts', { name: '', nature: 'Asset' });
  assert(bad.status === 400, `empty name → 400 (got ${bad.status})`);

  console.log('[e2e] shortcut reorder');
  const sc = await call('GET', '/api/shortcuts');
  const reversed = [...sc.body].reverse().map((s: { id: number }) => s.id);
  await call('POST', '/api/shortcuts/reorder', { ids: reversed });
  const sc2 = await call('GET', '/api/shortcuts');
  assert(sc2.body[0].id === reversed[0], 'reorder persisted (first id matches new order)');

  console.log('[e2e] journal entries — balance core');
  const chq = accounts.body.find((a: { id: number; name: string }) => a.name === 'Chequing');
  const sal = accounts.body.find((a: { id: number; name: string }) => a.name === 'Salary');
  const seeded = await call('GET', '/api/entries');
  assert(seeded.body.length === N_ENTRIES, `seeded entries = ${N_ENTRIES} (got ${seeded.body.length})`);

  const base = { entry_date: '2026-07-01', description: 'e2e pay', payee: 'X', category_id: null, income_source_id: null };
  const jeCreated = await call('POST', '/api/entries', {
    ...base,
    lines: [{ account_id: chq.id, side: 'debit', amount_cents: 12345 }, { account_id: sal.id, side: 'credit', amount_cents: 12345 }],
  });
  assert(jeCreated.status === 201 && jeCreated.body.lines.length === 2, 'create balanced entry → 201');

  const ub = await call('POST', '/api/entries', {
    ...base,
    lines: [{ account_id: chq.id, side: 'debit', amount_cents: 100 }, { account_id: sal.id, side: 'credit', amount_cents: 200 }],
  });
  assert(ub.status === 400 && /unbalanced/i.test(ub.body.error), 'unbalanced entry → 400');

  const single = await call('POST', '/api/entries', { ...base, lines: [{ account_id: chq.id, side: 'debit', amount_cents: 100 }] });
  assert(single.status === 400, 'single-line entry → 400');

  const foreign = await call('POST', '/api/entries', {
    ...base,
    lines: [{ account_id: 999999, side: 'debit', amount_cents: 100 }, { account_id: sal.id, side: 'credit', amount_cents: 100 }],
  });
  assert(foreign.status === 400 && /invalid/i.test(foreign.body.error), 'foreign/invalid account → 400');

  const edited = await call('PUT', `/api/entries/${jeCreated.body.id}`, {
    ...base, description: 'e2e edited',
    lines: [{ account_id: chq.id, side: 'debit', amount_cents: 5000 }, { account_id: sal.id, side: 'credit', amount_cents: 5000 }],
  });
  assert(edited.body.description === 'e2e edited' && edited.body.lines.length === 2, 'edit persisted');

  const delE = await call('DELETE', `/api/entries/${jeCreated.body.id}`);
  assert(delE.status === 200, 'delete entry → 200');
  const after = await call('GET', '/api/entries');
  assert(after.body.length === N_ENTRIES, `back to ${N_ENTRIES} entries (got ${after.body.length})`);

  console.log('[e2e] session isolation');
  const s1ids = new Set(after.body.map((e: { id: number }) => e.id));
  const visitor1Cookie = cookie; // kept to prove empty-reset can't cross sessions
  cookie = ''; // force a brand-new visitor
  await call('GET', '/api/session');
  const s2 = await call('GET', '/api/entries');
  assert(s2.body.length === N_ENTRIES, `second visitor has its own ${N_ENTRIES} entries`);
  assert(s2.body.every((e: { id: number }) => !s1ids.has(e.id)), 'session isolation: no shared entry ids');

  // Balances of this fresh session vs the expectation derived from the declarative seed
  // (independently re-aggregated by SQL server-side — verifies nature-aware Dr/Cr signing).
  console.log('[e2e] account balances (nature-aware)');
  const bals = await call('GET', '/api/accounts/balances');
  const bmap: Record<string, number> = Object.fromEntries(
    bals.body.map((a: { name: string; balance_cents: number }) => [a.name, a.balance_cents]),
  );
  const expected = seedExpectedBalances();
  for (const [name, val] of Object.entries(expected)) {
    assert(bmap[name] === val, `${name} balance = ${val} (got ${bmap[name]})`);
  }
  const expSum = (nature: string) =>
    Object.entries(expected)
      .filter(([name]) => SEED_ACCOUNT_NATURES[name] === nature)
      .reduce((s, [, v]) => s + v, 0);
  const sum = (nature: string) =>
    bals.body.filter((a: { nature: string }) => a.nature === nature)
      .reduce((s: number, a: { balance_cents: number }) => s + a.balance_cents, 0);
  const expNetWorth = expSum('Asset') - expSum('Liability');
  const expNetIncome = expSum('Revenue') - expSum('Expense');
  assert(sum('Asset') - sum('Liability') === expNetWorth, `net worth = ${expNetWorth} (got ${sum('Asset') - sum('Liability')})`);
  assert(sum('Revenue') - sum('Expense') === expNetIncome, `net income = ${expNetIncome} (got ${sum('Revenue') - sum('Expense')})`);

  // Quick Add semantics: the seeded Expense shortcut must debit the expense account and
  // credit cash. Post an entry from its defaults and check both balances move correctly.
  console.log('[e2e] quick add via shortcut defaults');
  const sc3 = await call('GET', '/api/shortcuts');
  const exp = sc3.body.find((s: { kind: string }) => s.kind === 'expense');
  const accts2 = await call('GET', '/api/accounts');
  const nameOf = (id: number) => accts2.body.find((a: { id: number }) => a.id === id)?.name;
  assert(nameOf(exp.default_account_id) === 'Groceries', 'expense shortcut debits Groceries');
  assert(nameOf(exp.default_counter_account_id) === 'Chequing', 'expense shortcut credits Chequing');

  const qa = await call('POST', '/api/entries', {
    entry_date: '2026-07-02', description: 'qa coffee', payee: null,
    category_id: exp.default_category_id, income_source_id: exp.default_income_source_id,
    lines: [
      { account_id: exp.default_account_id, side: 'debit', amount_cents: 1000 },
      { account_id: exp.default_counter_account_id, side: 'credit', amount_cents: 1000 },
    ],
  });
  assert(qa.status === 201, 'quick-add entry posted → 201');
  const bals2 = await call('GET', '/api/accounts/balances');
  const bmap2: Record<string, number> = Object.fromEntries(
    bals2.body.map((a: { name: string; balance_cents: number }) => [a.name, a.balance_cents]),
  );
  assert(bmap2['Groceries'] === expected['Groceries'] + 1000, `Groceries +$10 (got ${bmap2['Groceries']})`);
  assert(bmap2['Chequing'] === expected['Chequing'] - 1000, `Chequing −$10 (got ${bmap2['Chequing']})`);

  // Bulk import: one batch mixing valid, unbalanced, and foreign-account rows must
  // import the good rows and report per-index errors for the bad ones (no batch abort).
  console.log('[e2e] CSV bulk import — per-row isolation');
  const grocId = accts2.body.find((a: { name: string }) => a.name === 'Groceries').id;
  const chqId = accts2.body.find((a: { name: string }) => a.name === 'Chequing').id;
  const mk = (cents: number, debit: number, credit: number, extra?: object) => ({
    entry_date: '2026-07-03', description: 'imported row', payee: null,
    category_id: null, income_source_id: null,
    lines: [
      { account_id: debit, side: 'debit', amount_cents: cents },
      { account_id: credit, side: 'credit', amount_cents: cents },
    ],
    ...extra,
  });
  const badBalance = mk(1000, grocId, chqId);
  badBalance.lines[1].amount_cents = 999; // unbalance row 1
  const imp = await call('POST', '/api/entries/import', {
    entries: [
      mk(2500, grocId, chqId),          // valid
      badBalance,                        // unbalanced → error @1
      mk(1000, 999999, chqId),           // foreign account → error @2
      mk(4000, chqId, grocId),           // valid
    ],
  });
  assert(imp.status === 200, 'import batch → 200');
  assert(imp.body.imported === 2, `imported 2 of 4 (got ${imp.body.imported})`);
  assert(imp.body.errors.length === 2, `2 per-row errors (got ${imp.body.errors.length})`);
  assert(
    imp.body.errors.map((e: { index: number }) => e.index).join(',') === '1,2',
    'errors at indexes 1 and 2',
  );
  const entriesAfterImport = await call('GET', '/api/entries');
  const expAfterImport = N_ENTRIES + 3; // seed + qa + 2 imported
  assert(entriesAfterImport.body.length === expAfterImport, `entries now ${expAfterImport} (seed + qa + 2 imported; got ${entriesAfterImport.body.length})`);

  // Reset variants: {empty:true} wipes to a truly blank slate; plain reset re-seeds.
  console.log('[e2e] reset — empty vs re-seed');
  const emptied = await call('POST', '/api/session/reset', { empty: true });
  assert(emptied.status === 200 && emptied.body.empty === true, 'reset {empty:true} → 200');
  for (const e of ['accounts', 'categories', 'income-sources', 'shortcuts', 'entries'] as const) {
    const r = await call('GET', `/api/${e}`);
    assert(r.body.length === 0, `${e} = 0 after empty`);
  }
  // Cross-session guard: emptying visitor 2 must not touch visitor 1's data.
  const visitor2Cookie = cookie;
  cookie = visitor1Cookie;
  const v1After = await call('GET', '/api/entries');
  assert(v1After.body.length === N_ENTRIES, `visitor 1 unaffected by visitor 2's empty (${N_ENTRIES} entries intact)`);
  cookie = visitor2Cookie;
  const reseeded = await call('POST', '/api/session/reset');
  assert(reseeded.status === 200 && reseeded.body.empty === false, 'plain reset → 200');
  const accountsAfter = await call('GET', '/api/accounts');
  const entriesAfter = await call('GET', '/api/entries');
  assert(accountsAfter.body.length === SEED_COUNTS.accounts, `accounts restored to ${SEED_COUNTS.accounts}`);
  assert(entriesAfter.body.length === N_ENTRIES, `entries restored to ${N_ENTRIES}`);

  console.log('\n[e2e] PASS');
}

main().catch((err) => {
  console.error('\n[e2e] FAIL:', err.message);
  process.exit(1);
});
