import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMessagesWorker } from '../../../components/messages/messagesWorker';

vi.mock('../../../services/prisma/loadPrisma', () => ({
  QueueType: { VOCAL: 'vocal', MESSAGE: 'message' },
}));

vi.mock('../../../services/env', () => ({
  env: { APP_ENV: 'production', API_URL: 'http://localhost:3000' },
}));

type Row = {
  id: string;
  discordGuildId: string;
  content: string;
  duration: number;
  type: string;
  author: string | null;
  authorImage: string | null;
  submissionDate: Date;
  executionDate: Date;
  discordReceivedAt: Date | null;
  processingMs: number | null;
  busyRequeueMs: number;
};

type QueueWhere = { executionDate: { lte: Date }; discordGuildId: { notIn: string[] } };

// In-memory stand-in for the Queue and Guild tables, covering only the queries the worker runs.
function makeFakeDb() {
  const queue: Row[] = [];
  const guilds = new Map<string, { busyUntil: Date | null; maxMediaTime: number | null }>();

  const guildTable = {
    findMany: vi.fn(async ({ where }: { where: { busyUntil: { gte: Date } } }) =>
      [...guilds].filter(([, g]) => g.busyUntil && g.busyUntil >= where.busyUntil.gte).map(([id]) => ({ id })),
    ),
    findFirst: vi.fn(async ({ where }: { where: { id: string } }) => guilds.get(where.id) ?? null),
    upsert: vi.fn(async ({ where, update }: { where: { id: string }; update: { busyUntil: Date | null } }) => {
      guilds.set(where.id, { maxMediaTime: null, ...guilds.get(where.id), busyUntil: update.busyUntil });
    }),
  };

  const queueTable = {
    findFirst: vi.fn(async ({ where }: { where: QueueWhere }) => {
      const due = queue.filter(
        (r) => r.executionDate <= where.executionDate.lte && !where.discordGuildId.notIn.includes(r.discordGuildId),
      );
      due.sort(
        (a, b) =>
          a.executionDate.getTime() - b.executionDate.getTime() ||
          a.submissionDate.getTime() - b.submissionDate.getTime(),
      );
      return due[0] ?? null;
    }),
    deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
      const index = queue.findIndex((r) => r.id === where.id);
      if (index === -1) return { count: 0 };
      queue.splice(index, 1);
      return { count: 1 };
    }),
    update: vi.fn(),
  };

  const prisma = {
    queue: queueTable,
    guild: guildTable,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({ queue: queueTable, guild: guildTable })),
    stats: { upsert: vi.fn().mockResolvedValue({}) },
    latencySample: { create: vi.fn().mockResolvedValue({}) },
  };

  const enqueue = (id: string, discordGuildId: string, agoMs: number) => {
    const date = new Date(Date.now() - agoMs);
    queue.push({
      id,
      discordGuildId,
      content: JSON.stringify({ text: id }),
      duration: 5,
      type: 'message',
      author: null,
      authorImage: null,
      submissionDate: date,
      executionDate: date,
      discordReceivedAt: null,
      processingMs: null,
      busyRequeueMs: 0,
    });
  };

  const setBusy = (guildId: string, busyUntil: Date | null) =>
    guilds.set(guildId, { maxMediaTime: null, ...guilds.get(guildId), busyUntil });

  return { prisma, queue, enqueue, setBusy };
}

describe('executeMessagesWorker — FIFO per guild', () => {
  let db: ReturnType<typeof makeFakeDb>;
  let emitted: string[];
  const fastify = {
    io: {
      to: vi.fn(() => ({
        emit: (_event: string, payload: { content: string }) => emitted.push(JSON.parse(payload.content).text),
      })),
    },
  } as unknown as FastifyCustomInstance;

  beforeEach(() => {
    db = makeFakeDb();
    emitted = [];
    (global as Record<string, unknown>).prisma = db.prisma;
    (global as Record<string, unknown>).logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('plays the messages of a guild in submission order once it frees up', async () => {
    db.enqueue('first', 'g1', 3000);
    db.enqueue('second', 'g1', 2000);
    db.enqueue('third', 'g1', 1000);
    db.setBusy('g1', new Date(Date.now() + 60_000));

    for (let tick = 0; tick < 5; tick++) await executeMessagesWorker(fastify);
    expect(emitted).toEqual([]);

    for (let i = 0; i < 3; i++) {
      db.setBusy('g1', null);
      await executeMessagesWorker(fastify);
    }
    expect(emitted).toEqual(['first', 'second', 'third']);
  });

  it('does not touch the executionDate of messages waiting on a busy guild', async () => {
    db.enqueue('waiting', 'g1', 1000);
    const before = db.queue[0].executionDate.getTime();
    db.setBusy('g1', new Date(Date.now() + 60_000));

    await executeMessagesWorker(fastify);

    expect(db.queue[0].executionDate.getTime()).toBe(before);
    expect(db.prisma.queue.update).not.toHaveBeenCalled();
  });

  it('serves another guild while the oldest message waits on a busy guild', async () => {
    db.enqueue('blocked', 'g1', 2000);
    db.enqueue('free', 'g2', 1000);
    db.setBusy('g1', new Date(Date.now() + 60_000));

    await executeMessagesWorker(fastify);

    expect(emitted).toEqual(['free']);
    expect(db.queue.map((r) => r.id)).toEqual(['blocked']);
  });
});
