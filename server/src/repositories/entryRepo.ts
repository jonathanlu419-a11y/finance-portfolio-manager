import { query, queryOne, withTransaction } from '../db/pool';
import type { LineInput, Side } from '../domain/balance';

export interface EntryLine {
  id: number;
  account_id: number;
  account_name: string;
  account_nature: string;
  side: Side;
  amount_cents: number;
}

export interface EntryRow {
  id: number;
  entry_date: string;
  description: string | null;
  payee: string | null;
  category_id: number | null;
  income_source_id: number | null;
  category_name: string | null;
  income_source_name: string | null;
  lines: EntryLine[];
}

export interface EntryInput {
  entry_date: string;
  description?: string | null;
  payee?: string | null;
  category_id?: number | null;
  income_source_id?: number | null;
  lines: LineInput[];
}

// Shared SELECT that stitches header + category/income names + a json_agg of lines.
const SELECT_ENTRY = `
  SELECT e.id, e.entry_date, e.description, e.payee, e.category_id, e.income_source_id,
         c.name AS category_name, i.name AS income_source_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', l.id, 'account_id', l.account_id, 'account_name', a.name,
             'account_nature', a.nature, 'side', l.side, 'amount_cents', l.amount_cents
           ) ORDER BY l.side DESC, l.id)
           FROM journal_lines l JOIN accounts a ON a.id = l.account_id
           WHERE l.entry_id = e.id
         ), '[]'::json) AS lines
  FROM journal_entries e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN income_sources i ON i.id = e.income_source_id
  WHERE e.session_id = $1`;

export const entryRepo = {
  list(sessionId: string): Promise<EntryRow[]> {
    return query<EntryRow>(`${SELECT_ENTRY} ORDER BY e.entry_date DESC, e.id DESC`, [sessionId]);
  },

  getById(sessionId: string, id: number): Promise<EntryRow | undefined> {
    return queryOne<EntryRow>(`${SELECT_ENTRY} AND e.id = $2`, [sessionId, id]);
  },

  /**
   * Verify every referenced id belongs to this session (tenant isolation — the FKs alone
   * don't scope by session). Returns an error message or null.
   */
  async checkOwnership(
    sessionId: string,
    refs: { accountIds: number[]; categoryId?: number | null; incomeSourceId?: number | null },
  ): Promise<string | null> {
    const accountIds = [...new Set(refs.accountIds)];
    const owned = await query<{ id: number }>(
      'SELECT id FROM accounts WHERE session_id = $1 AND id = ANY($2::int[])',
      [sessionId, accountIds],
    );
    if (owned.length !== accountIds.length) return 'One or more line accounts are invalid.';
    if (refs.categoryId != null) {
      const c = await queryOne('SELECT 1 FROM categories WHERE session_id = $1 AND id = $2', [sessionId, refs.categoryId]);
      if (!c) return 'Invalid category.';
    }
    if (refs.incomeSourceId != null) {
      const i = await queryOne('SELECT 1 FROM income_sources WHERE session_id = $1 AND id = $2', [sessionId, refs.incomeSourceId]);
      if (!i) return 'Invalid income source.';
    }
    return null;
  },

  async create(sessionId: string, dto: EntryInput): Promise<EntryRow | undefined> {
    const id = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO journal_entries (session_id, entry_date, description, payee, category_id, income_source_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [sessionId, dto.entry_date, dto.description ?? null, dto.payee ?? null, dto.category_id ?? null, dto.income_source_id ?? null],
      );
      const entryId = rows[0].id;
      await insertLines(client, sessionId, entryId, dto.lines);
      return entryId;
    });
    return this.getById(sessionId, id);
  },

  async update(sessionId: string, id: number, dto: EntryInput): Promise<EntryRow | undefined> {
    const ok = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE journal_entries SET entry_date = $3, description = $4, payee = $5, category_id = $6, income_source_id = $7
         WHERE session_id = $1 AND id = $2`,
        [sessionId, id, dto.entry_date, dto.description ?? null, dto.payee ?? null, dto.category_id ?? null, dto.income_source_id ?? null],
      );
      if (!rowCount) return false;
      // Replace all lines (simplest correct strategy for an edit).
      await client.query('DELETE FROM journal_lines WHERE session_id = $1 AND entry_id = $2', [sessionId, id]);
      await insertLines(client, sessionId, id, dto.lines);
      return true;
    });
    return ok ? this.getById(sessionId, id) : undefined;
  },

  async remove(sessionId: string, id: number): Promise<boolean> {
    const rows = await query('DELETE FROM journal_entries WHERE session_id = $1 AND id = $2 RETURNING id', [sessionId, id]);
    return rows.length > 0;
  },
};

async function insertLines(
  client: import('pg').PoolClient,
  sessionId: string,
  entryId: number,
  lines: LineInput[],
): Promise<void> {
  for (const l of lines) {
    await client.query(
      `INSERT INTO journal_lines (session_id, entry_id, account_id, side, amount_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, entryId, l.account_id, l.side, l.amount_cents],
    );
  }
}
