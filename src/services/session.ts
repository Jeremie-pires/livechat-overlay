import crypto from 'crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map<string, number>();

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
};

export const isValidSession = (token?: string): boolean => {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
};
