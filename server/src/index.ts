import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pool } from './db/pool';
import { sessionMiddleware } from './middleware/session';
import { sessionRouter } from './routes/session';
import { accountsRouter } from './routes/accounts';
import { categoriesRouter, incomeSourcesRouter } from './routes/lookups';
import { shortcutsRouter } from './routes/shortcuts';
import { entriesRouter } from './routes/entries';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CORS only matters in dev (client on :5173, server on :3001). Prod is same-origin.
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
if (corsOrigin && corsOrigin.length > 0) {
  app.use(cors({ origin: corsOrigin, credentials: true }));
}

// Health check — no session required; verifies DB connectivity.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'down', error: (err as Error).message });
  }
});

// Everything below /api is session-scoped.
app.use('/api', sessionMiddleware);
app.use('/api', sessionRouter);
app.use('/api', accountsRouter);
app.use('/api', categoriesRouter);
app.use('/api', incomeSourcesRouter);
app.use('/api', shortcutsRouter);
app.use('/api', entriesRouter);

// Centralised error handler — repos/routes call next(err); we log and return 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: (err as Error)?.message ?? 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
