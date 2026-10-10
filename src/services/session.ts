import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EVICTION_INTERVAL_MS = 60 * 60 * 1000;
const sessions = new Map<string, number>();
const csrfTokens = new Map<string, string>();

export const evictExpiredSessions = (): void => {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (now > exp) {
      sessions.delete(token);
      csrfTokens.delete(token);
    }
  }
};

setInterval(evictExpiredSessions, EVICTION_INTERVAL_MS).unref();

export const createSession = (): string => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
};

export const getSessionToken = (cookieHeader?: string): string | undefined => {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith('session='));
  return match?.split('=').slice(1).join('=').trim();
};

export const deleteSession = (token: string): void => {
  sessions.delete(token);
  csrfTokens.delete(token);
};

export const isValidSession = (token?: string): boolean => {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    csrfTokens.delete(token);
    return false;
  }
  return true;
};

export const createCsrfToken = (sessionToken: string): string => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionToken, csrfToken);
  return csrfToken;
};

export const validateCsrfToken = (sessionToken: string | undefined, csrfToken: string | undefined): boolean => {
  if (!sessionToken || !csrfToken) return false;
  const expected = csrfTokens.get(sessionToken);
  if (!expected) return false;
  const a = Buffer.from(csrfToken);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

type AuthCheckResult = { ok: true; token: string } | { ok: false; status: 401 | 403; error: string };

export const checkRouteAuth = (
  cookie: string | undefined,
  csrfHeader: string | string[] | undefined,
): AuthCheckResult => {
  const token = getSessionToken(cookie);
  if (!isValidSession(token)) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!validateCsrfToken(token, csrfHeader as string | undefined))
    return { ok: false, status: 403, error: 'Invalid CSRF token' };
  return { ok: true, token: token as string };
};

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const auth = checkRouteAuth(req.headers.cookie, req.headers['x-csrf-token']);
  if (!auth.ok) reply.status(auth.status).send({ error: auth.error });
};
