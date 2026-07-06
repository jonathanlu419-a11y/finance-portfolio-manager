import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { sessionRepo } from '../repositories/sessionRepo';
import { seedSession } from '../db/seed';

const COOKIE_NAME = 'sid';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function setSidCookie(res: Response, sid: string): void {
  res.cookie(COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: ONE_YEAR_MS,
    path: '/',
  });
}

/**
 * Anonymous-session isolation — the whole auth story.
 * - No cookie (or a cookie whose session row no longer exists) → mint a new session id,
 *   create the row, auto-seed starter data, and set the httpOnly cookie.
 * - Existing session → bump last_seen_at.
 * Attaches req.sessionId; every downstream repo query filters by it.
 */
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let sid = req.cookies?.[COOKIE_NAME] as string | undefined;
    const existing = sid ? await sessionRepo.get(sid) : undefined;

    if (!existing) {
      sid = randomUUID();
      await sessionRepo.create(sid);
      await seedSession(sid);
      setSidCookie(res, sid);
    } else {
      await sessionRepo.touch(sid!);
    }

    req.sessionId = sid!;
    next();
  } catch (err) {
    next(err);
  }
}
