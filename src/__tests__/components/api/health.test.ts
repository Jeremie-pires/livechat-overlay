import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import Fastify from 'fastify';
import { HealthRoutes } from '../../../components/api/healthRoutes';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const resolveCorrelationId = (header: string | string[] | undefined): string => {
  if (typeof header === 'string' && UUID_V4_RE.test(header)) return header;
  return crypto.randomUUID();
};

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

  it('returns 503 when Prisma fails with sanitized reason', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { status: string; checks: Record<string, { ok: boolean; reason?: string }> };
    expect(body.status).toBe('degraded');
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.reason).toBeDefined();
    expect(body.checks.db.reason).not.toContain('DB error');
    expect(body.checks.db.reason).toMatch(/^Database connection failed/);
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
  const buildCorrelationApp = async () => {
    makeGlobals(true, true);
    const app = Fastify({ logger: false, genReqId: (req) => resolveCorrelationId(req.headers['x-request-id']) });
    await app.register(HealthRoutes(), { prefix: '/' });
    let capturedId: string | undefined;
    app.addHook('onRequest', (req, _reply, done) => {
      capturedId = req.id;
      done();
    });
    await app.ready();
    return { app, getId: () => capturedId };
  };

  it('propagates a valid UUID v4 x-request-id unchanged', async () => {
    const { app, getId } = await buildCorrelationApp();
    const validUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': validUuid } });
    await app.close();
    expect(getId()).toBe(validUuid);
  });

  it('generates a fresh UUID v4 when no x-request-id is provided', async () => {
    const { app, getId } = await buildCorrelationApp();
    await app.inject({ method: 'GET', url: '/health' });
    await app.close();
    expect(getId()).toMatch(UUID_V4_RE);
  });

  it('rejects an invalid x-request-id and generates a fresh UUID v4 (B1)', async () => {
    const { app, getId } = await buildCorrelationApp();
    await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'not-a-uuid' } });
    await app.close();
    const id = getId();
    expect(id).not.toBe('not-a-uuid');
    expect(id).toMatch(UUID_V4_RE);
  });

  it('rejects a v1 UUID x-request-id and generates a fresh UUID v4 (B1)', async () => {
    const { app, getId } = await buildCorrelationApp();
    const v1Uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': v1Uuid } });
    await app.close();
    const id = getId();
    expect(id).not.toBe(v1Uuid);
    expect(id).toMatch(UUID_V4_RE);
  });
});

describe('GET /health/ready — DB error sanitization (B4)', () => {
  it('does not expose raw error message in reason', async () => {
    (global as Record<string, unknown>).env = { APP_ENV: 'production' };
    (global as Record<string, unknown>).prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused: sqlite://./prisma/sqlite.db')),
    };
    (global as Record<string, unknown>).discordClient = { isReady: () => true };
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    await app.close();
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { checks: Record<string, { ok: boolean; reason?: string }> };
    expect(body.checks.db.reason).not.toContain('Connection refused');
    expect(body.checks.db.reason).not.toContain('sqlite');
    expect(body.checks.db.reason).toBe('Database connection failed');
  });

  it('includes err.code when the thrown error has a Prisma code property (B4)', async () => {
    const prismaError = Object.assign(new Error('Prisma internal'), { code: 'P1001' });
    (global as Record<string, unknown>).env = { APP_ENV: 'production' };
    (global as Record<string, unknown>).prisma = { $queryRaw: vi.fn().mockRejectedValue(prismaError) };
    (global as Record<string, unknown>).discordClient = { isReady: () => true };
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    await app.close();
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { checks: Record<string, { ok: boolean; reason?: string }> };
    expect(body.checks.db.reason).toBe('Database connection failed (P1001)');
    expect(body.checks.db.reason).not.toContain('Prisma internal');
  });
});
