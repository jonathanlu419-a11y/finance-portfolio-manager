/**
 * Per-session starter data. A brand-new anonymous visitor gets a small, realistic
 * dataset so the app isn't empty on first load. Also used by "Reset demo data":
 * resetSession() wipes the session's rows and re-seeds.
 *
 * All money is integer cents. Sample journal entries are real balanced Dr/Cr entries.
 */
import type { PoolClient } from 'pg';
import { withTransaction } from './pool';

type NewLine = { accountId: number; side: 'debit' | 'credit'; amountCents: number };

async function insertEntry(
  client: PoolClient,
  sessionId: string,
  e: {
    date: string;
    description: string;
    payee?: string | null;
    categoryId?: number | null;
    incomeSourceId?: number | null;
    lines: NewLine[];
  },
): Promise<void> {
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO journal_entries (session_id, entry_date, description, payee, category_id, income_source_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [sessionId, e.date, e.description, e.payee ?? null, e.categoryId ?? null, e.incomeSourceId ?? null],
  );
  const entryId = rows[0].id;
  for (const l of e.lines) {
    await client.query(
      `INSERT INTO journal_lines (session_id, entry_id, account_id, side, amount_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, entryId, l.accountId, l.side, l.amountCents],
    );
  }
}

/** Delete every domain row for a session (FK cascade from sessions handles order, but we
 *  keep the sessions row itself so the cookie stays valid). */
export async function deleteSessionData(client: PoolClient, sessionId: string): Promise<void> {
  // journal_lines & journal_entries cascade from entries; delete explicitly for clarity.
  await client.query('DELETE FROM journal_lines WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM journal_entries WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM shortcuts WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM accounts WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM categories WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM income_sources WHERE session_id = $1', [sessionId]);
}

/** Insert the starter dataset for a session inside the given transaction. */
async function insertStarterData(client: PoolClient, sessionId: string): Promise<void> {
  // ── Accounts ──────────────────────────────────────────────────────────────
  const accountRows: Array<{ code: string; name: string; nature: string; start: number }> = [
    { code: 'A100', name: 'Chequing', nature: 'Asset', start: 250000 },
    { code: 'A200', name: 'Savings', nature: 'Asset', start: 1000000 },
    { code: 'L100', name: 'Credit Card', nature: 'Liability', start: 0 },
    { code: 'R100', name: 'Salary', nature: 'Revenue', start: 0 },
    { code: 'E100', name: 'Groceries', nature: 'Expense', start: 0 },
    { code: 'E200', name: 'Rent', nature: 'Expense', start: 0 },
    { code: 'E300', name: 'Dining', nature: 'Expense', start: 0 },
  ];
  const acct: Record<string, number> = {};
  for (const a of accountRows) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO accounts (session_id, code, name, nature, starting_balance_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, a.code, a.name, a.nature, a.start],
    );
    acct[a.name] = rows[0].id;
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryNames = ['Groceries', 'Rent', 'Dining', 'Salary', 'Transfer', 'Utilities'];
  const cat: Record<string, number> = {};
  for (const name of categoryNames) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO categories (session_id, name) VALUES ($1, $2) RETURNING id`,
      [sessionId, name],
    );
    cat[name] = rows[0].id;
  }

  // ── Income sources ──────────────────────────────────────────────────────────
  const incomeSourceNames = ['Employment', 'Interest', 'Government', 'Gift'];
  const inc: Record<string, number> = {};
  for (const name of incomeSourceNames) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO income_sources (session_id, name) VALUES ($1, $2) RETURNING id`,
      [sessionId, name],
    );
    inc[name] = rows[0].id;
  }

  // ── Quick Add shortcuts (visitor can edit these later) ──────────────────────
  const shortcutRows = [
    { label: 'Expense', icon: 'shopping-cart', kind: 'expense', account: 'Chequing', counter: 'Groceries', category: 'Groceries', income: null, sort: 0 },
    { label: 'Income', icon: 'banknote', kind: 'income', account: 'Chequing', counter: 'Salary', category: 'Salary', income: 'Employment', sort: 1 },
    { label: 'Transfer', icon: 'arrow-left-right', kind: 'transfer', account: 'Savings', counter: 'Chequing', category: 'Transfer', income: null, sort: 2 },
    { label: 'Card Payment', icon: 'credit-card', kind: 'card_payment', account: 'Credit Card', counter: 'Chequing', category: null, income: null, sort: 3 },
  ];
  for (const s of shortcutRows) {
    await client.query(
      `INSERT INTO shortcuts
         (session_id, label, icon, kind, default_account_id, default_counter_account_id, default_category_id, default_income_source_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        sessionId, s.label, s.icon, s.kind,
        acct[s.account] ?? null,
        s.counter ? acct[s.counter] ?? null : null,
        s.category ? cat[s.category] ?? null : null,
        s.income ? inc[s.income] ?? null : null,
        s.sort,
      ],
    );
  }

  // ── Sample journal entries (all balanced) ───────────────────────────────────
  await insertEntry(client, sessionId, {
    date: '2026-06-01', description: 'Monthly salary', payee: 'Acme Corp',
    categoryId: cat['Salary'], incomeSourceId: inc['Employment'],
    lines: [
      { accountId: acct['Chequing'], side: 'debit', amountCents: 300000 },
      { accountId: acct['Salary'], side: 'credit', amountCents: 300000 },
    ],
  });
  await insertEntry(client, sessionId, {
    date: '2026-06-02', description: 'Rent payment', payee: 'Landlord', categoryId: cat['Rent'],
    lines: [
      { accountId: acct['Rent'], side: 'debit', amountCents: 150000 },
      { accountId: acct['Chequing'], side: 'credit', amountCents: 150000 },
    ],
  });
  await insertEntry(client, sessionId, {
    date: '2026-06-05', description: 'Grocery run', payee: 'FreshMart', categoryId: cat['Groceries'],
    lines: [
      { accountId: acct['Groceries'], side: 'debit', amountCents: 8550 },
      { accountId: acct['Chequing'], side: 'credit', amountCents: 8550 },
    ],
  });
  await insertEntry(client, sessionId, {
    date: '2026-06-08', description: 'Dinner out', payee: 'Bistro 22', categoryId: cat['Dining'],
    lines: [
      { accountId: acct['Dining'], side: 'debit', amountCents: 4200 },
      { accountId: acct['Credit Card'], side: 'credit', amountCents: 4200 },
    ],
  });
  await insertEntry(client, sessionId, {
    date: '2026-06-10', description: 'Move to savings', categoryId: cat['Transfer'],
    lines: [
      { accountId: acct['Savings'], side: 'debit', amountCents: 50000 },
      { accountId: acct['Chequing'], side: 'credit', amountCents: 50000 },
    ],
  });
}

/** Seed a session that has just been created (called from the session middleware). */
export async function seedSession(sessionId: string): Promise<void> {
  await withTransaction((client) => insertStarterData(client, sessionId));
}

/** Wipe the session's data and re-seed it (the "Reset demo data" action). */
export async function resetSession(sessionId: string): Promise<void> {
  await withTransaction(async (client) => {
    await deleteSessionData(client, sessionId);
    await insertStarterData(client, sessionId);
  });
}
