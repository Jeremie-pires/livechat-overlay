import crypto from 'crypto';

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
