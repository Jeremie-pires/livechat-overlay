import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import {
  createSession,
  getSessionToken,
  isValidSession,
  createCsrfToken,
  evictExpiredSessions,
  requireAuth,
} from '../../services/session';

describe('createSession', () => {
  it('returns a 64-char hex token (32 bytes)', () => {
    const token = createSession();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates unique tokens on each call', () => {
    const t1 = createSession();
    const t2 = createSession();
    expect(t1).not.toBe(t2);
  });
});

describe('getSessionToken', () => {
  it('extracts token from simple cookie header', () => {
    expect(getSessionToken('session=abc123')).toBe('abc123');
  });

  it('extracts token among multiple cookies', () => {
    expect(getSessionToken('other=val; session=tok456; another=x')).toBe('tok456');
  });

  it('returns undefined if session cookie is absent', () => {
    expect(getSessionToken('other=val')).toBeUndefined();
  });

  it('returns undefined if cookie header is absent', () => {
    expect(getSessionToken(undefined)).toBeUndefined();
  });

  it('handles token containing "=" correctly', () => {
    expect(getSessionToken('session=base64=padded==')).toBe('base64=padded==');
  });
});

describe('isValidSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a recently created valid token', () => {
    const token = createSession();
    expect(isValidSession(token)).toBe(true);
  });

  it('returns false for unknown token', () => {
    expect(isValidSession('unknown-token')).toBe(false);
  });

  it('returns false for undefined token', () => {
    expect(isValidSession(undefined)).toBe(false);
  });

  it('returns false and deletes token after expiry (7 days)', () => {
    const token = createSession();
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    expect(isValidSession(token)).toBe(false);
    expect(isValidSession(token)).toBe(false);
  });

  it('returns true just before expiry', () => {
    const token = createSession();
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(isValidSession(token)).toBe(true);
  });
});

describe('evictExpiredSessions (I-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes expired sessions and their CSRF tokens on eviction sweep', () => {
    const token = createSession();
    createCsrfToken(token);
    expect(isValidSession(token)).toBe(true);

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    evictExpiredSessions();

    expect(isValidSession(token)).toBe(false);
  });

  it('preserves non-expired sessions during eviction sweep', () => {
    const token = createSession();
    expect(isValidSession(token)).toBe(true);

    evictExpiredSessions();

    expect(isValidSession(token)).toBe(true);
  });

  it('eviction sweep removes multiple expired sessions in one pass', () => {
    const t1 = createSession();
    const t2 = createSession();
    const t3 = createSession();

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
    evictExpiredSessions();

    expect(isValidSession(t1)).toBe(false);
    expect(isValidSession(t2)).toBe(false);
    expect(isValidSession(t3)).toBe(false);
  });
});

// ── requireAuth — async Fastify preHandler (audit fix B-2) ────────────────────

describe('requireAuth — async preHandler', () => {
  const buildApp = async () => {
    const app = Fastify({ logger: false });
    app.get('/protected', { preHandler: requireAuth }, async () => ({ ok: true }));
    await app.ready();
    return app;
  };

  it('returns 401 when no cookie is present', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/protected' });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when session cookie token is invalid', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: 'session=notavalidtoken' },
    });
    await app.close();
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when session is valid but CSRF token is absent', async () => {
    const token = createSession();
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `session=${token}` },
    });
    await app.close();
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 when session and CSRF token are both valid', async () => {
    const token = createSession();
    const csrf = createCsrfToken(token);
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `session=${token}`, 'x-csrf-token': csrf },
    });
    await app.close();
    expect(res.statusCode).toBe(200);
  });

  it('handler completes without hanging — resolves in under 200 ms', async () => {
    const token = createSession();
    const csrf = createCsrfToken(token);
    const app = await buildApp();
    const start = Date.now();
    await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `session=${token}`, 'x-csrf-token': csrf },
    });
    await app.close();
    expect(Date.now() - start).toBeLessThan(200);
  });
});
