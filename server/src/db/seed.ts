/**
 * Per-session starter data. A brand-new anonymous visitor gets a realistic, clearly
 * fictional dataset so the app demos well on first load. Also used by "Reset demo"
 * (wipe + re-seed) and "Empty data" (wipe only).
 *
 * All money is integer cents; every entry is a balanced 2-line Dr/Cr journal entry
 * inserted through the same shape the app's own entry creation uses.
 *
 * Entry dates are RELATIVE (daysAgo at seed time, spanning ~10 weeks) so the
 * dashboard's This Month / 30-day windows always have data regardless of when a
 * visitor first arrives.
 *
 * The seed is declarative (ACCOUNT_DEFS / SEED_ENTRIES below), and the expected
 * row counts and per-account balances are EXPORTED and computed from the same
 * tables — smoke/e2e consume those instead of hand-maintained constants.
 */
import type { PoolClient } from 'pg';
import { withTransaction } from './pool';

// ── Declarative seed data ─────────────────────────────────────────────────────

type Nature = 'Asset' | 'Liability' | 'Revenue' | 'Expense';

const ACCOUNT_DEFS: { code: string; name: string; nature: Nature; start: number }[] = [
  { code: 'A100', name: 'Chequing', nature: 'Asset', start: 250000 },
  { code: 'A200', name: 'Savings', nature: 'Asset', start: 1000000 },
  { code: 'L100', name: 'Credit Card', nature: 'Liability', start: 0 },
  { code: 'R100', name: 'Salary', nature: 'Revenue', start: 0 },
  { code: 'R200', name: 'Other Income', nature: 'Revenue', start: 0 },
  { code: 'E100', name: 'Groceries', nature: 'Expense', start: 0 },
  { code: 'E200', name: 'Rent', nature: 'Expense', start: 0 },
  { code: 'E300', name: 'Dining', nature: 'Expense', start: 0 },
  { code: 'E400', name: 'Utilities', nature: 'Expense', start: 0 },
  { code: 'E500', name: 'Entertainment', nature: 'Expense', start: 0 },
  { code: 'E600', name: 'Transportation', nature: 'Expense', start: 0 },
];

const CATEGORY_NAMES = [
  'Groceries', 'Rent', 'Dining', 'Salary', 'Transfer', 'Utilities', 'Entertainment', 'Transportation',
];

const INCOME_SOURCE_NAMES = ['Employment', 'Freelance', 'Interest', 'Government', 'Gift'];

interface SeedEntry {
  daysAgo: number;
  description: string;
  payee?: string;
  category?: string;
  incomeSource?: string;
  debit: string;  // account name
  credit: string; // account name
  cents: number;
}

// ~10 weeks of activity. daysAgo 0 guarantees "This Month" is never empty, even on the 1st.
const SEED_ENTRIES: SeedEntry[] = [
  // Income — salary (monthly) + freelance + interest
  { daysAgo: 3, description: 'Monthly salary', payee: 'Acme Corp', category: 'Salary', incomeSource: 'Employment', debit: 'Chequing', credit: 'Salary', cents: 300000 },
  { daysAgo: 33, description: 'Monthly salary', payee: 'Acme Corp', category: 'Salary', incomeSource: 'Employment', debit: 'Chequing', credit: 'Salary', cents: 300000 },
  { daysAgo: 63, description: 'Monthly salary', payee: 'Acme Corp', category: 'Salary', incomeSource: 'Employment', debit: 'Chequing', credit: 'Salary', cents: 300000 },
  { daysAgo: 10, description: 'Freelance project', payee: 'Bright Studio', incomeSource: 'Freelance', debit: 'Chequing', credit: 'Other Income', cents: 80000 },
  { daysAgo: 48, description: 'Freelance retainer', payee: 'Bright Studio', incomeSource: 'Freelance', debit: 'Chequing', credit: 'Other Income', cents: 60000 },
  { daysAgo: 25, description: 'Savings interest', payee: 'Bank', incomeSource: 'Interest', debit: 'Savings', credit: 'Other Income', cents: 1250 },
  // Rent (monthly)
  { daysAgo: 2, description: 'Rent payment', payee: 'Landlord', category: 'Rent', debit: 'Rent', credit: 'Chequing', cents: 150000 },
  { daysAgo: 32, description: 'Rent payment', payee: 'Landlord', category: 'Rent', debit: 'Rent', credit: 'Chequing', cents: 150000 },
  { daysAgo: 62, description: 'Rent payment', payee: 'Landlord', category: 'Rent', debit: 'Rent', credit: 'Chequing', cents: 150000 },
  // Groceries
  { daysAgo: 1, description: 'Grocery run', payee: 'FreshMart', category: 'Groceries', debit: 'Groceries', credit: 'Chequing', cents: 8550 },
  { daysAgo: 6, description: 'Weekly groceries', payee: 'FreshMart', category: 'Groceries', debit: 'Groceries', credit: 'Credit Card', cents: 9230 },
  { daysAgo: 13, description: 'Groceries', payee: 'Village Market', category: 'Groceries', debit: 'Groceries', credit: 'Chequing', cents: 7820 },
  { daysAgo: 36, description: 'Groceries', payee: 'FreshMart', category: 'Groceries', debit: 'Groceries', credit: 'Chequing', cents: 10115 },
  { daysAgo: 52, description: 'Groceries', payee: 'FreshMart', category: 'Groceries', debit: 'Groceries', credit: 'Chequing', cents: 8860 },
  // Dining
  { daysAgo: 0, description: 'Coffee', payee: 'Cafe Nero', category: 'Dining', debit: 'Dining', credit: 'Credit Card', cents: 675 },
  { daysAgo: 4, description: 'Dinner out', payee: 'Bistro 22', category: 'Dining', debit: 'Dining', credit: 'Credit Card', cents: 4200 },
  { daysAgo: 20, description: 'Lunch', payee: 'Noodle Bar', category: 'Dining', debit: 'Dining', credit: 'Chequing', cents: 2350 },
  { daysAgo: 47, description: 'Dinner', payee: 'Bistro 22', category: 'Dining', debit: 'Dining', credit: 'Credit Card', cents: 6575 },
  // Utilities
  { daysAgo: 8, description: 'Hydro bill', payee: 'City Hydro', category: 'Utilities', debit: 'Utilities', credit: 'Chequing', cents: 12040 },
  { daysAgo: 38, description: 'Internet', payee: 'NetCo', category: 'Utilities', debit: 'Utilities', credit: 'Chequing', cents: 7900 },
  { daysAgo: 68, description: 'Hydro bill', payee: 'City Hydro', category: 'Utilities', debit: 'Utilities', credit: 'Chequing', cents: 11860 },
  // Entertainment
  { daysAgo: 14, description: 'Movie night', payee: 'Cineplex', category: 'Entertainment', debit: 'Entertainment', credit: 'Credit Card', cents: 3400 },
  { daysAgo: 44, description: 'Concert tickets', payee: 'TicketHub', category: 'Entertainment', debit: 'Entertainment', credit: 'Credit Card', cents: 15800 },
  // Transportation
  { daysAgo: 9, description: 'Transit pass', payee: 'Metro', category: 'Transportation', debit: 'Transportation', credit: 'Chequing', cents: 15600 },
  { daysAgo: 39, description: 'Gas', payee: 'PetroStop', category: 'Transportation', debit: 'Transportation', credit: 'Credit Card', cents: 6025 },
  // Transfers & card payments
  { daysAgo: 5, description: 'Move to savings', category: 'Transfer', debit: 'Savings', credit: 'Chequing', cents: 50000 },
  { daysAgo: 15, description: 'Card payment', debit: 'Credit Card', credit: 'Chequing', cents: 20000 },
  { daysAgo: 45, description: 'Card payment', debit: 'Credit Card', credit: 'Chequing', cents: 25000 },
];

// ── Exported expectations (smoke/e2e consume these — no hand-kept constants) ──

export const SEED_COUNTS = {
  accounts: ACCOUNT_DEFS.length,
  categories: CATEGORY_NAMES.length,
  income_sources: INCOME_SOURCE_NAMES.length,
  shortcuts: 4,
  journal_entries: SEED_ENTRIES.length,
} as const;

export const SEED_ACCOUNT_NATURES: Record<string, Nature> = Object.fromEntries(
  ACCOUNT_DEFS.map((a) => [a.name, a.nature]),
);

/** Nature-aware expected balance per account, derived from the declarative seed. */
export function seedExpectedBalances(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of ACCOUNT_DEFS) {
    let net = 0;
    for (const e of SEED_ENTRIES) {
      if (e.debit === a.name) net += e.cents;
      if (e.credit === a.name) net -= e.cents;
    }
    const debitNormal = a.nature === 'Asset' || a.nature === 'Expense';
    out[a.name] = a.start + (debitNormal ? net : -net);
  }
  return out;
}

// ── Insertion ─────────────────────────────────────────────────────────────────

function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
}

/** Delete every domain row for a session (the sessions row itself stays so the
 *  cookie remains valid). Session-scoped by construction. */
export async function deleteSessionData(client: PoolClient, sessionId: string): Promise<void> {
  await client.query('DELETE FROM journal_lines WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM journal_entries WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM shortcuts WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM accounts WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM categories WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM income_sources WHERE session_id = $1', [sessionId]);
}

async function insertStarterData(client: PoolClient, sessionId: string): Promise<void> {
  // Accounts
  const acct: Record<string, number> = {};
  for (const a of ACCOUNT_DEFS) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO accounts (session_id, code, name, nature, starting_balance_cents)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, a.code, a.name, a.nature, a.start],
    );
    acct[a.name] = rows[0].id;
  }

  // Categories
  const cat: Record<string, number> = {};
  for (const name of CATEGORY_NAMES) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO categories (session_id, name) VALUES ($1, $2) RETURNING id`,
      [sessionId, name],
    );
    cat[name] = rows[0].id;
  }

  // Income sources
  const inc: Record<string, number> = {};
  for (const name of INCOME_SOURCE_NAMES) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO income_sources (session_id, name) VALUES ($1, $2) RETURNING id`,
      [sessionId, name],
    );
    inc[name] = rows[0].id;
  }

  // Quick Add shortcuts (visitor can edit these later).
  // Convention: `account` = the DEBIT leg, `counter` = the CREDIT leg.
  //   expense:      Dr Groceries (expense up)   / Cr Chequing (cash down)
  //   income:       Dr Chequing (cash up)       / Cr Salary (revenue up)
  //   transfer:     Dr Savings (to)             / Cr Chequing (from)
  //   card_payment: Dr Credit Card (debt down)  / Cr Chequing (cash down)
  const shortcutRows = [
    { label: 'Expense', icon: 'shopping-cart', kind: 'expense', account: 'Groceries', counter: 'Chequing', category: 'Groceries', income: null, sort: 0 },
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

  // Journal entries — balanced 2-line Dr/Cr, dated relative to today.
  for (const e of SEED_ENTRIES) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO journal_entries (session_id, entry_date, description, payee, category_id, income_source_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        sessionId, daysAgoISO(e.daysAgo), e.description, e.payee ?? null,
        e.category ? cat[e.category] ?? null : null,
        e.incomeSource ? inc[e.incomeSource] ?? null : null,
      ],
    );
    const entryId = rows[0].id;
    await client.query(
      `INSERT INTO journal_lines (session_id, entry_id, account_id, side, amount_cents)
       VALUES ($1, $2, $3, 'debit', $4)`,
      [sessionId, entryId, acct[e.debit], e.cents],
    );
    await client.query(
      `INSERT INTO journal_lines (session_id, entry_id, account_id, side, amount_cents)
       VALUES ($1, $2, $3, 'credit', $4)`,
      [sessionId, entryId, acct[e.credit], e.cents],
    );
  }
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

/** Wipe the session's data WITHOUT re-seeding (the "Empty data" action). */
export async function emptySession(sessionId: string): Promise<void> {
  await withTransaction((client) => deleteSessionData(client, sessionId));
}
