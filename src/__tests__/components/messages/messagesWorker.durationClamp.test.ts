import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/prisma/loadPrisma', () => ({
  QueueType: { VOCAL: 'vocal', MESSAGE: 'message' },
}));

import { resolveMediaDurationMs } from '../../../components/messages/messagesWorker';

describe('messagesWorker — resolveMediaDurationMs clamp (US-4)', () => {
  it('returns fallback 5000 ms for undefined input', () => {
    expect(resolveMediaDurationMs(undefined)).toBe(5000);
  });

  it('returns fallback 5000 ms for null input', () => {
    expect(resolveMediaDurationMs(null)).toBe(5000);
  });

  it('returns fallback 5000 ms for NaN input', () => {
    expect(resolveMediaDurationMs(NaN)).toBe(5000);
  });

  it('returns fallback 5000 ms for Infinity input', () => {
    expect(resolveMediaDurationMs(Infinity)).toBe(5000);
  });

  it('returns fallback 5000 ms for -Infinity input', () => {
    expect(resolveMediaDurationMs(-Infinity)).toBe(5000);
  });

  it('returns fallback 5000 ms for zero (falsy path)', () => {
    expect(resolveMediaDurationMs(0)).toBe(5000);
  });

  it('returns fallback 5000 ms for negative duration', () => {
    expect(resolveMediaDurationMs(-10)).toBe(5000);
  });

  it('clamps 999999 s to MAX_MEDIA_DURATION_S → 3 600 000 ms', () => {
    expect(resolveMediaDurationMs(999999)).toBe(3_600_000);
  });

  it('clamps exactly 3600 s to 3 600 000 ms (boundary)', () => {
    expect(resolveMediaDurationMs(3600)).toBe(3_600_000);
  });

  it('clamps 3601 s to 3 600 000 ms (one over boundary)', () => {
    expect(resolveMediaDurationMs(3601)).toBe(3_600_000);
  });

  it('returns 30 000 ms for normal 30 s duration', () => {
    expect(resolveMediaDurationMs(30)).toBe(30_000);
  });

  it('returns 1000 ms for minimum non-zero 1 s duration', () => {
    expect(resolveMediaDurationMs(1)).toBe(1_000);
  });

  it('coerces numeric string "120" to 120 000 ms', () => {
    expect(resolveMediaDurationMs('120')).toBe(120_000);
  });

  it('returns fallback 5000 ms for non-numeric string', () => {
    expect(resolveMediaDurationMs('abc')).toBe(5000);
  });
});
