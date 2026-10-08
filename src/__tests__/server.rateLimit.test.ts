import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import { isRateLimitExempt } from '../services/utils';

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
