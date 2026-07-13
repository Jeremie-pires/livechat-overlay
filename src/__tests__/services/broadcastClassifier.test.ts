import { describe, it, expect } from 'vitest';
import { classifyDiscordError, type BroadcastResult } from '../../services/broadcastClassifier';

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
