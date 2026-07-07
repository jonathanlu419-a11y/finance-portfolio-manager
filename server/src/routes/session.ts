import { Router } from 'express';
import { sessionRepo } from '../repositories/sessionRepo';
import { resetSession, emptySession } from '../db/seed';

export const sessionRouter = Router();

// Lightweight "who am I" — confirms the session is live (used by the client on boot).
sessionRouter.get('/session', async (req, res, next) => {
  try {
    const s = await sessionRepo.get(req.sessionId);
    res.json({ ok: true, createdAt: s?.created_at ?? null });
  } catch (err) {
    next(err);
  }
});

// "Reset demo data" — wipe this session's rows and re-seed the starter dataset.
// With body {empty: true}: wipe WITHOUT re-seeding (start from a truly blank slate).
// Both paths operate solely on req.sessionId — no cross-session reach.
sessionRouter.post('/session/reset', async (req, res, next) => {
  try {
    const empty = req.body?.empty === true;
    if (empty) await emptySession(req.sessionId);
    else await resetSession(req.sessionId);
    res.json({ ok: true, empty });
  } catch (err) {
    next(err);
  }
});
