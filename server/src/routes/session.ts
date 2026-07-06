import { Router } from 'express';
import { sessionRepo } from '../repositories/sessionRepo';
import { resetSession } from '../db/seed';

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
sessionRouter.post('/session/reset', async (req, res, next) => {
  try {
    await resetSession(req.sessionId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
