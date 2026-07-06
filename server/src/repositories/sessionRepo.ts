import { query, queryOne } from '../db/pool';

export interface SessionRow {
  session_id: string;
  created_at: string;
  last_seen_at: string;
}

export const sessionRepo = {
  get(sessionId: string): Promise<SessionRow | undefined> {
    return queryOne<SessionRow>('SELECT * FROM sessions WHERE session_id = $1', [sessionId]);
  },

  async create(sessionId: string): Promise<void> {
    await query('INSERT INTO sessions (session_id) VALUES ($1) ON CONFLICT DO NOTHING', [sessionId]);
  },

  async touch(sessionId: string): Promise<void> {
    await query('UPDATE sessions SET last_seen_at = now() WHERE session_id = $1', [sessionId]);
  },
};
