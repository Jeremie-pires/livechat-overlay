import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module-level mocks ---
vi.mock('../../services/broadcastClassifier', () => ({
  classifyDiscordError: vi.fn(() => ({
    errorCode: '50001',
    errorReason: 'Missing Access',
  })),
  mintRunId: vi.fn(() => 'mock-run-id'),
  persistBroadcastRun: vi.fn().mockResolvedValue(undefined),
}));

import { broadcastToAllGuilds } from '../../services/broadcast';
import { classifyDiscordError, mintRunId, persistBroadcastRun } from '../../services/broadcastClassifier';

const makeChannel = (overrides: Partial<{ isTextBased: () => boolean; send: () => Promise<void> }> = {}) => ({
  isTextBased: vi.fn(() => true),
  send: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const setupGlobals = (
  guilds: { id: string; channelId: string | null }[],
  channel: ReturnType<typeof makeChannel> | null,
) => {
  // @ts-ignore
  global.prisma = {
    guild: {
      findMany: vi.fn().mockResolvedValue(guilds),
    },
    broadcastLog: {
      createMany: vi.fn().mockResolvedValue({ count: guilds.length }),
    },
  };
  // @ts-ignore
  global.discordClient = {
    channels: {
      fetch: vi.fn().mockResolvedValue(channel),
    },
  };
};

describe('broadcastToAllGuilds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array and skips persistBroadcastRun when no guilds have channelId', async () => {
    setupGlobals([], makeChannel());
    const results = await broadcastToAllGuilds('Title', 'Msg', 0x3498db);
    expect(results).toHaveLength(0);
    expect(persistBroadcastRun).toHaveBeenCalledWith('mock-run-id', []);
  });

  it('returns SUCCESS result when channel.send succeeds', async () => {
    const channel = makeChannel();
    setupGlobals([{ id: 'g1', channelId: 'ch1' }], channel);
    const results = await broadcastToAllGuilds('Title', 'Msg', 0x2ecc71);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('SUCCESS');
    expect(results[0].guildId).toBe('g1');
    expect(results[0].channelId).toBe('ch1');
  });

  it('returns FAILED result with classified error when channel.send throws', async () => {
    const channel = makeChannel({ send: vi.fn().mockRejectedValue({ code: 50001, message: 'Missing Access' }) });
    setupGlobals([{ id: 'g2', channelId: 'ch2' }], channel);
    const results = await broadcastToAllGuilds('Title', 'Msg', 0xe74c3c);
    expect(results[0].status).toBe('FAILED');
    expect(results[0].errorCode).toBe('50001');
    expect(results[0].errorReason).toBe('Missing Access');
    expect(classifyDiscordError).toHaveBeenCalledOnce();
  });

  it('returns FAILED with NOT_TEXT error when channel is not text-based', async () => {
    const channel = makeChannel({ isTextBased: vi.fn(() => false) });
    setupGlobals([{ id: 'g3', channelId: 'ch3' }], channel);
    const results = await broadcastToAllGuilds('Title', 'Msg', 0);
    expect(results[0].status).toBe('FAILED');
    expect(results[0].errorCode).toBe('NOT_TEXT');
  });

  it('returns FAILED with NOT_TEXT error when channel.fetch returns null', async () => {
    setupGlobals([{ id: 'g4', channelId: 'ch4' }], null);
    const results = await broadcastToAllGuilds('Title', 'Msg', 0);
    expect(results[0].status).toBe('FAILED');
    expect(results[0].errorCode).toBe('NOT_TEXT');
  });

  it('handles mixed success and failure across multiple guilds', async () => {
    const successChannel = makeChannel();
    const failChannel = makeChannel({ send: vi.fn().mockRejectedValue({ code: 50013 }) });
    // @ts-ignore
    global.prisma = {
      guild: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'g5', channelId: 'ch5' },
          { id: 'g6', channelId: 'ch6' },
          { id: 'g7', channelId: 'ch7' },
        ]),
      },
    };
    let fetchCount = 0;
    // @ts-ignore
    global.discordClient = {
      channels: { fetch: vi.fn(() => Promise.resolve(fetchCount++ === 1 ? failChannel : successChannel)) },
    };

    const results = await broadcastToAllGuilds('Multi', 'Test', 0);
    const successes = results.filter((r) => r.status === 'SUCCESS');
    const failures = results.filter((r) => r.status === 'FAILED');
    expect(successes.length + failures.length).toBe(3);
    expect(failures.length).toBeGreaterThanOrEqual(1);
  });

  it('calls mintRunId once per broadcast run', async () => {
    setupGlobals([{ id: 'g8', channelId: 'ch8' }], makeChannel());
    await broadcastToAllGuilds('T', 'M', 0);
    expect(mintRunId).toHaveBeenCalledOnce();
  });

  it('calls persistBroadcastRun with runId and all results', async () => {
    const ch = makeChannel();
    setupGlobals([{ id: 'g9', channelId: 'ch9' }], ch);
    await broadcastToAllGuilds('T', 'M', 0);
    expect(persistBroadcastRun).toHaveBeenCalledOnce();
    const [runId, results] = (persistBroadcastRun as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(runId).toBe('mock-run-id');
    expect(results).toHaveLength(1);
  });
});
