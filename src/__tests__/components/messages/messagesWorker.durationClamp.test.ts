import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/prisma/loadPrisma', () => ({
  QueueType: { VOCAL: 'vocal', MESSAGE: 'message' },
}));

import { resolveMediaDurationMs } from '../../../components/messages/messagesWorker';

describe('messagesWorker — resolveMediaDurationMs clamp (US-4)', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['0 (falsy)', 0],
    ['-10 (negative)', -10],
    ['"abc" (non-numeric string)', 'abc'],
  ] as [string, unknown][])('returns 5000 ms fallback for %s', (_, input) => {
    expect(resolveMediaDurationMs(input)).toBe(5000);
  });

  it.each([
    [999999, 3_600_000],
    [3600, 3_600_000],
    [3601, 3_600_000],
    [30, 30_000],
    [1, 1_000],
  ])('clamps %d s → %d ms', (input, expected) => {
    expect(resolveMediaDurationMs(input)).toBe(expected);
  });

  it('coerces numeric string "120" to 120 000 ms', () => {
    expect(resolveMediaDurationMs('120')).toBe(120_000);
  });
});
