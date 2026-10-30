import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import { createCorsDelegator, LOCAL_OVERLAY_ORIGIN } from '../../services/cors';

const API_ORIGIN = 'https://api.example.test';

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(FastifyCORS, () => createCorsDelegator(API_ORIGIN));
  app.get('/api/video', async () => ({ ok: true }));
  app.get('/api/stats', async () => ({ ok: true }));
  await app.ready();
  return app;
};

describe('CORS delegator', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(() => {
    (global as unknown as { logger: { warn: () => void } }).logger = { warn: () => undefined };
  });

  afterEach(() => app?.close());

  it('allows the local overlay origin on /api/video, ignoring the query string', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/video?t=abc', headers: { origin: LOCAL_OVERLAY_ORIGIN } });
    expect(res.headers['access-control-allow-origin']).toBe(LOCAL_OVERLAY_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-expose-headers']).toContain('Content-Range');
  });

  it('answers the preflight for the local overlay origin on /api/video', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/video?t=abc',
      headers: {
        origin: LOCAL_OVERLAY_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'range',
      },
    });
    expect(res.headers['access-control-allow-origin']).toBe(LOCAL_OVERLAY_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toBe('GET, OPTIONS');
  });

  it('rejects the local overlay origin on other routes', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats', headers: { origin: LOCAL_OVERLAY_ORIGIN } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a foreign origin on /api/video', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/video?t=abc',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps allowing the API origin with credentials on other routes', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/stats', headers: { origin: API_ORIGIN } });
    expect(res.headers['access-control-allow-origin']).toBe(API_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
