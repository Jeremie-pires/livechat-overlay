import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/prisma/loadPrisma', () => ({
  QueueType: { VOCAL: 'vocal', MESSAGE: 'message' },
}));

vi.mock('../../../services/env', () => ({
  env: { APP_ENV: 'production', API_URL: 'http://localhost:3000' },
}));

type MockTx = {
  queue: {
    deleteMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  guild: {
    findFirst: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function makeCandidate(duration: number) {
  return {
    id: 'msg-1',
    discordGuildId: '111222333',
    duration,
    content: JSON.stringify({ text: 'hello' }),
    author: 'Tester',
    authorImage: null,
    type: 'message',
    submissionDate: new Date(),
    discordReceivedAt: null,
    processingMs: null,
    busyRequeueMs: 0,
  };
}

function makeMockPrisma(maxMediaTime: number | null, candidateDuration: number) {
  const candidate = makeCandidate(candidateDuration);
  const tx: MockTx = {
    queue: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    guild: {
      findFirst: vi.fn().mockResolvedValue({ busyUntil: null, maxMediaTime }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    queue: { findFirst: vi.fn().mockResolvedValue(candidate) },
    $transaction: vi.fn().mockImplementation((cb: (tx: MockTx) => unknown) => cb(tx)),
    stats: { upsert: vi.fn().mockResolvedValue({}) },
    latencySample: { create: vi.fn().mockResolvedValue({}) },
    _tx: tx,
  };
}

describe('executeMessagesWorker — maxMediaTime clamp', () => {
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn();
    (global as Record<string, unknown>).logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  async function run(maxMediaTime: number | null, candidateDuration: number) {
    const mockPrisma = makeMockPrisma(maxMediaTime, candidateDuration);
    (global as Record<string, unknown>).prisma = mockPrisma;
    const mockFastify = {
      io: { to: vi.fn().mockReturnValue({ emit: emitSpy }) },
    };
    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    await executeMessagesWorker(mockFastify as unknown as FastifyCustomInstance);
    return emitSpy.mock.calls[0]?.[1] as { duration: number } | undefined;
  }

  it('clamps duration to maxMediaTime when duration exceeds it', async () => {
    const emitted = await run(30, 60);
    expect(emitted?.duration).toBe(30);
  });

  it('does not clamp when duration is below maxMediaTime', async () => {
    const emitted = await run(120, 60);
    expect(emitted?.duration).toBe(60);
  });

  it('does not clamp when maxMediaTime is 0', async () => {
    const emitted = await run(0, 60);
    expect(emitted?.duration).toBe(60);
  });

  it('does not clamp when maxMediaTime is null', async () => {
    const emitted = await run(null, 60);
    expect(emitted?.duration).toBe(60);
  });

  it('duration equals maxMediaTime exactly — no clamp applied', async () => {
    const emitted = await run(60, 60);
    expect(emitted?.duration).toBe(60);
  });
});
