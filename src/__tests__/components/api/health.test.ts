import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { HealthRoutes } from '../../../components/api/healthRoutes';

// Minimal global stubs
const makeGlobals = (dbOk: boolean, discordReady: boolean) => {
  (global as Record<string, unknown>).env = { APP_ENV: 'production' };
  (global as Record<string, unknown>).prisma = {
    $queryRaw: dbOk ? vi.fn().mockResolvedValue([{ '1': 1 }]) : vi.fn().mockRejectedValue(new Error('DB error')),
  };
  (global as Record<string, unknown>).discordClient = { isReady: () => discordReady };
};

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(HealthRoutes(), { prefix: '/' });
  await app.ready();
  return app;
};

describe('GET /health', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    makeGlobals(true, true);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string; env: string; uptime: number };
    expect(body.status).toBe('ok');
    expect(body.env).toBe('production');
    expect(typeof body.uptime).toBe('number');
  });
});

describe('GET /health/ready — all green', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    makeGlobals(true, true);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('returns 200 when Prisma and Discord are ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string; checks: Record<string, { ok: boolean }> };
    expect(body.status).toBe('ok');
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.discord.ok).toBe(true);
  });
});

describe('GET /health/ready — DB down', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    makeGlobals(false, true);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('returns 503 when Prisma fails', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { status: string; checks: Record<string, { ok: boolean; reason?: string }> };
    expect(body.status).toBe('degraded');
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.reason).toBeDefined();
  });
});

describe('GET /health/ready — Discord not ready', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    makeGlobals(true, false);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('returns 503 when Discord client is not ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { status: string; checks: Record<string, { ok: boolean }> };
    expect(body.status).toBe('degraded');
    expect(body.checks.discord.ok).toBe(false);
  });
});

describe('GET /health/ready — both down', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    makeGlobals(false, false);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('returns 503 when both dependencies are down', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { status: string; checks: Record<string, { ok: boolean }> };
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.discord.ok).toBe(false);
  });
});

describe('Correlation ID propagation', () => {
  it('uses x-request-id header when provided', async () => {
    makeGlobals(true, true);
    const app = Fastify({
      logger: false,
      genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    });
    await app.register(HealthRoutes(), { prefix: '/' });

    let capturedId: string | undefined;
    app.addHook('onRequest', (req, _reply, done) => {
      capturedId = req.id;
      done();
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'trace-abc-123' } });
    await app.close();

    expect(capturedId).toBe('trace-abc-123');
  });

  it('generates a UUID when no x-request-id is provided', async () => {
    makeGlobals(true, true);
    const app = Fastify({
      logger: false,
      genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    });
    await app.register(HealthRoutes(), { prefix: '/' });

    let capturedId: string | undefined;
    app.addHook('onRequest', (req, _reply, done) => {
      capturedId = req.id;
      done();
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(capturedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
