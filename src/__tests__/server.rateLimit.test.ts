import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import { isRateLimitExempt } from '../services/utils';
import { TRUSTED_PROXIES } from '../services/trustedProxies';

const RATE_LIMIT_MAX = 3;

const buildApp = async () => {
  const app = Fastify({ logger: false });

  await app.register(FastifyRateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    allowList: isRateLimitExempt,
  });

  app.get('/health', async (_req, reply) => reply.send({ status: 'ok' }));
  app.get('/health/ready', async (_req, reply) => reply.send({ status: 'ok' }));
  app.get('/api/probe', async (_req, reply) => reply.send({ ok: true }));

  await app.ready();
  return app;
};

describe('Rate-limit skip — /health routes are exempt', () => {
  let app: ReturnType<typeof Fastify>;

  afterEach(() => app?.close());

  it('never returns 429 on /health regardless of request count', async () => {
    app = await buildApp();
    const requests = RATE_LIMIT_MAX + 2;
    for (let i = 0; i < requests; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode, `request ${i + 1} to /health should not be rate-limited`).not.toBe(429);
    }
  });

  it('never returns 429 on /health/ready regardless of request count', async () => {
    app = await buildApp();
    const requests = RATE_LIMIT_MAX + 2;
    for (let i = 0; i < requests; i++) {
      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode, `request ${i + 1} to /health/ready should not be rate-limited`).not.toBe(429);
    }
  });

  it('returns 429 on non-health routes after limit is exceeded', async () => {
    app = await buildApp();
    const statuses: number[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX + 1; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/probe' });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, RATE_LIMIT_MAX)).toEqual(Array(RATE_LIMIT_MAX).fill(200));
    expect(statuses[RATE_LIMIT_MAX]).toBe(429);
  });
});

describe('isRateLimitExempt — overlay page', () => {
  it.each(['/client', '/client?guildId=1&token=abc', '/client/assets/app.js'])('exempts %s', (url) => {
    expect(isRateLimitExempt({ url })).toBe(true);
  });

  it.each(['/clients', '/client-stats', '/api/video?t=1'])('does not exempt %s', (url) => {
    expect(isRateLimitExempt({ url })).toBe(false);
  });
});

describe('Rate-limit key — real client IP behind Cloudflare, HAProxy and docker-proxy', () => {
  let app: ReturnType<typeof Fastify>;

  afterEach(() => app?.close());

  const DOCKER_GATEWAY = '172.18.0.1';
  const CLOUDFLARE_EDGE = '172.70.1.1';

  const buildKeyedApp = async () => {
    const keyedApp = Fastify({ logger: false, trustProxy: TRUSTED_PROXIES });
    await keyedApp.register(FastifyRateLimit, {
      max: RATE_LIMIT_MAX,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
    });
    keyedApp.get('/api/probe', async (req, reply) => reply.send({ ip: req.ip }));
    await keyedApp.ready();
    return keyedApp;
  };

  // HAProxy appends the address it received the request from, so the header ends with the Cloudflare edge.
  const viaCloudflare = (clientIp: string, forged?: string) => ({
    remoteAddress: DOCKER_GATEWAY,
    headers: { 'x-forwarded-for': [forged, clientIp, CLOUDFLARE_EDGE].filter(Boolean).join(', ') },
  });

  it('uses the client IP for requests coming through Cloudflare', async () => {
    app = await buildKeyedApp();
    const res = await app.inject({ method: 'GET', url: '/api/probe', ...viaCloudflare('9.9.9.9') });
    expect(res.json()).toEqual({ ip: '9.9.9.9' });
  });

  it('uses the client IP for requests reaching HAProxy directly', async () => {
    app = await buildKeyedApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/probe',
      remoteAddress: DOCKER_GATEWAY,
      headers: { 'x-forwarded-for': '9.9.9.9' },
    });
    expect(res.json()).toEqual({ ip: '9.9.9.9' });
  });

  it('ignores an X-Forwarded-For value forged by the client', async () => {
    app = await buildKeyedApp();
    const res = await app.inject({ method: 'GET', url: '/api/probe', ...viaCloudflare('9.9.9.9', '1.2.3.4') });
    expect(res.json()).toEqual({ ip: '9.9.9.9' });
  });

  it('gives each client its own quota', async () => {
    app = await buildKeyedApp();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await app.inject({ method: 'GET', url: '/api/probe', ...viaCloudflare('9.9.9.9') });
    }
    const exhausted = await app.inject({ method: 'GET', url: '/api/probe', ...viaCloudflare('9.9.9.9') });
    const otherClient = await app.inject({ method: 'GET', url: '/api/probe', ...viaCloudflare('8.8.8.8') });

    expect(exhausted.statusCode).toBe(429);
    expect(otherClient.statusCode).toBe(200);
  });
});
