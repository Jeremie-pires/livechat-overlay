import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyDiscordError,
  mintRunId,
  persistBroadcastRun,
  type BroadcastResult,
} from '../../services/broadcastClassifier';

describe('classifyDiscordError', () => {
  it('maps code 50001 to Missing Access', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 50001, message: 'Missing Access' });
    expect(errorCode).toBe('50001');
    expect(errorReason).toBe('Missing Access');
  });

  it('maps code 10003 to Unknown Channel', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 10003, message: 'Unknown Channel' });
    expect(errorCode).toBe('10003');
    expect(errorReason).toBe('Unknown Channel');
  });

  it('maps code 50013 to Missing Permissions', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 50013 });
    expect(errorCode).toBe('50013');
    expect(errorReason).toBe('Missing Permissions');
  });

  it('maps code 50007 to Cannot Send Messages', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 50007 });
    expect(errorCode).toBe('50007');
    expect(errorReason).toBe('Cannot Send Messages');
  });

  it('falls back to message text for unknown code', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 99999, message: 'Some unexpected error' });
    expect(errorCode).toBe('99999');
    expect(errorReason).toBe('Some unexpected error');
  });

  it('truncates long messages to 100 chars + ellipsis', () => {
    const longMsg = 'a'.repeat(120);
    const { errorCode, errorReason } = classifyDiscordError({ code: 99998, message: longMsg });
    expect(errorCode).toBe('99998');
    expect(errorReason).toHaveLength(101);
    expect(errorReason.endsWith('…')).toBe(true);
  });

  it('handles errors without message property', () => {
    const { errorCode, errorReason } = classifyDiscordError({ code: 50001 });
    expect(errorCode).toBe('50001');
    expect(errorReason).toBe('Missing Access');
  });

  it('handles non-object errors (string)', () => {
    const { errorCode, errorReason } = classifyDiscordError('network timeout');
    expect(errorCode).toBe('UNKNOWN');
    expect(errorReason).toBe('network timeout');
  });

  it('handles null', () => {
    const { errorCode, errorReason } = classifyDiscordError(null);
    expect(errorCode).toBe('UNKNOWN');
    expect(errorReason).toBe('null');
  });

  it('handles undefined', () => {
    const { errorCode, errorReason } = classifyDiscordError(undefined);
    expect(errorCode).toBe('UNKNOWN');
    expect(errorReason).toBe('undefined');
  });
});

describe('BroadcastResult aggregation', () => {
  const results: BroadcastResult[] = [
    { guildId: '1', channelId: 'c1', status: 'SUCCESS' },
    { guildId: '2', channelId: 'c2', status: 'FAILED', errorCode: '50001', errorReason: 'Missing Access' },
    { guildId: '3', channelId: 'c3', status: 'SUCCESS' },
    { guildId: '4', channelId: null, status: 'FAILED', errorCode: '10003', errorReason: 'Unknown Channel' },
  ];

  it('counts successes correctly', () => {
    const sent = results.filter((r) => r.status === 'SUCCESS').length;
    expect(sent).toBe(2);
  });

  it('counts failures correctly', () => {
    const failed = results.filter((r) => r.status === 'FAILED').length;
    expect(failed).toBe(2);
  });

  it('all results have a guildId', () => {
    expect(results.every((r) => typeof r.guildId === 'string')).toBe(true);
  });

  it('failed results have errorCode and errorReason', () => {
    const failed = results.filter((r) => r.status === 'FAILED');
    expect(failed.every((r) => r.errorCode && r.errorReason)).toBe(true);
  });
});

describe('mintRunId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = mintRunId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates unique IDs on each call', () => {
    const ids = Array.from({ length: 20 }, mintRunId);
    expect(new Set(ids).size).toBe(20);
  });
});

describe('persistBroadcastRun', () => {
  const mockCreateMany = vi.fn().mockResolvedValue({ count: 2 });

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    global.prisma = { broadcastLog: { createMany: mockCreateMany } };
    // @ts-ignore
    global.logger = { error: vi.fn() };
  });

  it('calls createMany with correctly shaped data', async () => {
    const results: BroadcastResult[] = [
      { guildId: '111', channelId: 'c1', status: 'SUCCESS' },
      { guildId: '222', channelId: null, status: 'FAILED', errorCode: '50001', errorReason: 'Missing Access' },
    ];
    await persistBroadcastRun('run-1', results);
    expect(mockCreateMany).toHaveBeenCalledOnce();
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        { runId: 'run-1', guildId: '111', channelId: 'c1', status: 'SUCCESS', errorCode: null, errorReason: null },
        {
          runId: 'run-1',
          guildId: '222',
          channelId: null,
          status: 'FAILED',
          errorCode: '50001',
          errorReason: 'Missing Access',
        },
      ],
    });
  });

  it('short-circuits and does not call createMany when results is empty', async () => {
    await persistBroadcastRun('run-2', []);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('sets errorCode and errorReason to null when undefined', async () => {
    const results: BroadcastResult[] = [{ guildId: '333', channelId: 'c3', status: 'SUCCESS' }];
    await persistBroadcastRun('run-3', results);
    const [call] = mockCreateMany.mock.calls;
    expect(call[0].data[0].errorCode).toBeNull();
    expect(call[0].data[0].errorReason).toBeNull();
  });

  it('resolves without throwing when createMany rejects (fail-safe)', async () => {
    const dbError = new Error('DB locked');
    mockCreateMany.mockRejectedValueOnce(dbError);
    const mockLoggerError = vi.fn();
    // @ts-ignore
    global.logger = { error: mockLoggerError };
    const results: BroadcastResult[] = [{ guildId: '444', channelId: 'c4', status: 'SUCCESS' }];
    await expect(persistBroadcastRun('run-4', results)).resolves.toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalledOnce();
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: dbError, runId: 'run-4' },
      '[BroadcastClassifier] Failed to persist broadcast run',
    );
  });
});
