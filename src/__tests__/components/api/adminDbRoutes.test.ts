import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// Mock session validation
vi.mock('../../../services/session', () => ({
  getSessionToken: vi.fn((cookie?: string) => (cookie?.includes('session=valid') ? 'valid-token' : undefined)),
  isValidSession: vi.fn((token?: string) => token === 'valid-token'),
}));

import { AdminDbRoutes } from '../../../components/api/adminDbRoutes';

const AUTH_COOKIE = 'session=valid';

const buildApp = async () => {
  const app = Fastify();
  // @ts-ignore
  app.register(AdminDbRoutes(), { prefix: '/api/admin' });
  await app.ready();
  return app;
};

const mockPrismaGuild = (overrides: Partial<Record<string, unknown>> = {}) => ({
  findMany: vi.fn().mockResolvedValue([]),
  findUnique: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue({}),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  ...overrides,
});

const mockPrismaBroadcastLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  findFirst: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  ...overrides,
});

describe('GET /api/admin/db/guilds — auth guard', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-ignore
    global.prisma = {
      guild: mockPrismaGuild(),
      broadcastLog: mockPrismaBroadcastLog(),
    };
    // @ts-ignore
    global.discordClient = { guilds: { cache: { get: vi.fn().mockReturnValue(undefined) } } };
    app = await buildApp();
  });

  it('returns 401 with no session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/db/guilds' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe('Unauthorized');
  });

  it('returns 200 with valid session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/db/guilds',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBeInstanceOf(Array);
  });

  it('returns guild rows with enriched Discord fields', async () => {
    const guild = {
      id: '123456789012345678',
      channelId: 'ch1',
      defaultMediaTime: 10,
      maxMediaTime: 60,
      displayMediaFull: false,
    };
    const discordGuild = { name: 'Test Guild', iconURL: vi.fn(() => 'https://cdn.discord.com/icon.png') };
    // @ts-ignore
    global.prisma.guild.findMany = vi.fn().mockResolvedValue([guild]);
    // @ts-ignore
    global.discordClient.guilds.cache.get = vi.fn().mockReturnValue(discordGuild);

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/db/guilds',
      headers: { cookie: AUTH_COOKIE },
    });
    const rows = JSON.parse(res.body);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Test Guild');
    expect(rows[0].connected).toBe(true);
    expect(rows[0].id).toBe('123456789012345678');
  });

  it('returns lastBroadcast populated from the guild own latest BroadcastLog entry', async () => {
    const guild = {
      id: '123456789012345678',
      channelId: 'ch1',
      defaultMediaTime: null,
      maxMediaTime: null,
      displayMediaFull: false,
    };
    const broadcastLog = {
      guildId: '123456789012345678',
      status: 'SUCCESS',
      errorReason: null,
      createdAt: new Date('2026-07-14T10:00:00Z'),
    };
    // @ts-ignore
    global.prisma.guild.findMany = vi.fn().mockResolvedValue([guild]);
    // @ts-ignore
    global.prisma.broadcastLog.findMany = vi.fn().mockResolvedValue([broadcastLog]);

    const res = await app.inject({ method: 'GET', url: '/api/admin/db/guilds', headers: { cookie: AUTH_COOKIE } });
    const rows = JSON.parse(res.body);
    expect(rows[0].lastBroadcast).not.toBeNull();
    expect(rows[0].lastBroadcast.status).toBe('SUCCESS');
    expect(rows[0].lastBroadcast.at).toBeDefined();
  });

  it('returns lastBroadcast as null when no BroadcastLog entry exists for the guild', async () => {
    const guild = {
      id: '999888777666555444',
      channelId: null,
      defaultMediaTime: null,
      maxMediaTime: null,
      displayMediaFull: false,
    };
    // @ts-ignore
    global.prisma.guild.findMany = vi.fn().mockResolvedValue([guild]);
    // @ts-ignore
    global.prisma.broadcastLog.findMany = vi.fn().mockResolvedValue([]);

    const res = await app.inject({ method: 'GET', url: '/api/admin/db/guilds', headers: { cookie: AUTH_COOKIE } });
    const rows = JSON.parse(res.body);
    expect(rows[0].lastBroadcast).toBeNull();
  });

  it('returns the most recent BroadcastLog entry per guild when multiple exist', async () => {
    const guild = {
      id: '111222333444555666',
      channelId: 'ch2',
      defaultMediaTime: null,
      maxMediaTime: null,
      displayMediaFull: false,
    };
    const logs = [
      {
        guildId: '111222333444555666',
        status: 'SUCCESS',
        errorReason: null,
        createdAt: new Date('2026-07-14T12:00:00Z'),
      },
      {
        guildId: '111222333444555666',
        status: 'FAILED',
        errorReason: 'Missing Access',
        createdAt: new Date('2026-07-13T10:00:00Z'),
      },
    ];
    // @ts-ignore
    global.prisma.guild.findMany = vi.fn().mockResolvedValue([guild]);
    // @ts-ignore
    global.prisma.broadcastLog.findMany = vi.fn().mockResolvedValue(logs);

    const res = await app.inject({ method: 'GET', url: '/api/admin/db/guilds', headers: { cookie: AUTH_COOKIE } });
    const rows = JSON.parse(res.body);
    expect(rows[0].lastBroadcast.status).toBe('SUCCESS');
  });
});

describe('DELETE /api/admin/db/guilds/:id — auth + validation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('returns 401 without session', async () => {
    // @ts-ignore
    global.prisma = { guild: mockPrismaGuild(), botEvent: { create: vi.fn() } };
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/db/guilds/123456789012345678' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid snowflake format (letters)', async () => {
    // @ts-ignore
    global.prisma = { guild: mockPrismaGuild(), botEvent: { create: vi.fn() } };
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/db/guilds/not-a-snowflake',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Invalid guild ID format');
  });

  it('returns 400 for snowflake too short (< 17 digits)', async () => {
    // @ts-ignore
    global.prisma = { guild: mockPrismaGuild(), botEvent: { create: vi.fn() } };
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/db/guilds/1234',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for snowflake too long (> 20 digits)', async () => {
    // @ts-ignore
    global.prisma = { guild: mockPrismaGuild(), botEvent: { create: vi.fn() } };
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/db/guilds/123456789012345678901',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when guild not found in DB', async () => {
    // @ts-ignore
    global.prisma = {
      guild: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() },
      botEvent: { create: vi.fn() },
    };
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/db/guilds/123456789012345678',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('Guild not found');
  });

  it('returns 200 with deletedId and creates BotEvent audit log', async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    const mockCreateEvent = vi.fn().mockResolvedValue({});
    // @ts-ignore
    global.prisma = {
      guild: {
        findUnique: vi.fn().mockResolvedValue({ id: '123456789012345678' }),
        delete: mockDelete,
      },
      botEvent: { create: mockCreateEvent },
    };
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/db/guilds/123456789012345678',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.deletedId).toBe('123456789012345678');
    expect(mockCreateEvent).toHaveBeenCalledOnce();
    expect(mockCreateEvent.mock.calls[0][0].data.type).toBe('DB_PURGE');
  });
});

describe('GET /api/admin/db/broadcasts/latest', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('returns 401 without session', async () => {
    // @ts-ignore
    global.prisma = { broadcastLog: mockPrismaBroadcastLog() };
    const res = await app.inject({ method: 'GET', url: '/api/admin/db/broadcasts/latest' });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty summary when no broadcast runs exist', async () => {
    // @ts-ignore
    global.prisma = { broadcastLog: mockPrismaBroadcastLog() };
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/db/broadcasts/latest',
      headers: { cookie: AUTH_COOKIE },
    });
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.runId).toBeNull();
    expect(body.total).toBe(0);
    expect(body.rows).toHaveLength(0);
  });

  it('returns correct succeeded/failed counts for latest run', async () => {
    const rows = [
      {
        id: 1,
        runId: 'run-abc',
        guildId: 'g1',
        status: 'SUCCESS',
        channelId: 'c1',
        errorCode: null,
        errorReason: null,
        createdAt: new Date(),
      },
      {
        id: 2,
        runId: 'run-abc',
        guildId: 'g2',
        status: 'FAILED',
        channelId: 'c2',
        errorCode: '50001',
        errorReason: 'Missing Access',
        createdAt: new Date(),
      },
      {
        id: 3,
        runId: 'run-abc',
        guildId: 'g3',
        status: 'SUCCESS',
        channelId: 'c3',
        errorCode: null,
        errorReason: null,
        createdAt: new Date(),
      },
    ];
    // @ts-ignore
    global.prisma = {
      broadcastLog: {
        findFirst: vi.fn().mockResolvedValue({ runId: 'run-abc', createdAt: new Date() }),
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/db/broadcasts/latest',
      headers: { cookie: AUTH_COOKIE },
    });
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.runId).toBe('run-abc');
    expect(body.total).toBe(3);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.rows).toHaveLength(3);
  });
});
