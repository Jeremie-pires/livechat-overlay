import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/prisma/loadPrisma', () => ({
  QueueType: { VOCAL: 'vocal', MESSAGE: 'message' },
}));

vi.mock('../../../services/env', () => ({
  env: { APP_ENV: 'test' },
}));

// Capture what gets emitted
let lastEmit: { event: string; payload: unknown } | null = null;

const makeFastify = () =>
  ({
    io: {
      to: () => ({
        emit: (event: string, payload: unknown) => {
          lastEmit = { event, payload };
        },
      }),
    },
  }) as unknown as FastifyCustomInstance;

const makeCandidate = (contentOverrides: Record<string, unknown>) => ({
  id: 'msg-1',
  discordGuildId: 'guild-1',
  author: 'testuser',
  authorImage: null,
  content: JSON.stringify({ mediaContentType: 'image/png', ...contentOverrides }),
  duration: 10,
  type: 'message',
  submissionDate: new Date(),
  discordReceivedAt: new Date(),
  processingMs: 0,
  busyRequeueMs: 0,
});

// Minimal prisma stub that immediately returns the candidate
const makePrisma = (candidate: ReturnType<typeof makeCandidate>) => ({
  queue: {
    findFirst: vi.fn().mockResolvedValue(candidate),
    update: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  guild: {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn(),
  },
  stats: { upsert: vi.fn().mockResolvedValue({}) },
  latencySample: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      guild: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      queue: {
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return fn(tx);
  }),
});

beforeEach(() => {
  lastEmit = null;
  (global as Record<string, unknown>).logger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() };
});

describe('messagesWorker — sanitize media from emit payload (H-AUD-06)', () => {
  it('removes media and promotes it to url when url is absent', async () => {
    const candidate = makeCandidate({ media: 'https://cdn.discordapp.com/attachments/123/file.png' });
    (global as Record<string, unknown>).prisma = makePrisma(candidate);

    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    await executeMessagesWorker(makeFastify());

    expect(lastEmit).not.toBeNull();
    const payload = lastEmit!.payload as { content: string };
    const emittedContent = JSON.parse(payload.content);
    expect(emittedContent.media).toBeUndefined();
    expect(emittedContent.url).toBe('https://cdn.discordapp.com/attachments/123/file.png');
  });

  it('removes media but preserves existing url when both are present', async () => {
    const candidate = makeCandidate({
      url: 'https://example.com/api/video?t=TOKEN',
      media: 'https://cdn.discordapp.com/attachments/123/file.mp4',
    });
    (global as Record<string, unknown>).prisma = makePrisma(candidate);

    vi.resetModules();
    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    await executeMessagesWorker(makeFastify());

    expect(lastEmit).not.toBeNull();
    const payload = lastEmit!.payload as { content: string };
    const emittedContent = JSON.parse(payload.content);
    expect(emittedContent.media).toBeUndefined();
    expect(emittedContent.url).toBe('https://example.com/api/video?t=TOKEN');
  });

  it('does NOT promote media when url is an empty string (== null guard, not falsy)', async () => {
    const candidate = makeCandidate({
      url: '',
      media: 'https://cdn.discordapp.com/attachments/123/file.png',
    });
    (global as Record<string, unknown>).prisma = makePrisma(candidate);

    vi.resetModules();
    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    await executeMessagesWorker(makeFastify());

    expect(lastEmit).not.toBeNull();
    const payload = lastEmit!.payload as { content: string };
    const emittedContent = JSON.parse(payload.content);
    expect(emittedContent.media).toBeUndefined();
    expect(emittedContent.url).toBe('');
  });

  it('emits unchanged content when neither url nor media is present', async () => {
    const candidate = makeCandidate({ text: 'Hello!' });
    (global as Record<string, unknown>).prisma = makePrisma(candidate);

    vi.resetModules();
    const { executeMessagesWorker } = await import('../../../components/messages/messagesWorker');
    await executeMessagesWorker(makeFastify());

    expect(lastEmit).not.toBeNull();
    const payload = lastEmit!.payload as { content: string };
    const emittedContent = JSON.parse(payload.content);
    expect(emittedContent.media).toBeUndefined();
    expect(emittedContent.url).toBeUndefined();
    expect(emittedContent.text).toBe('Hello!');
  });
});
