import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../../services/utils';

describe('parseDuration (shared helper — sendCommand / hidesendCommand)', () => {
  it.each([
    ['full', 29.4, 30],
    ['full', null, 'error'],
    ['full', undefined, 'error'],
  ] as [string, number | null | undefined, number | 'error'][])(
    '"%s" with mediaDuration=%s → %s',
    (input, media, expected) => {
      expect(parseDuration(input, media)).toBe(expected);
    },
  );

  it.each([
    ['30', 30],
    ['1', 1],
    ['3600', 3600],
    ['1.5', 1],
  ])('valid "%s" → %d', (input, expected) => {
    expect(parseDuration(input, undefined)).toBe(expected);
  });

  it.each([['3601'], ['0'], ['-5'], ['abc'], ['']])('"%s" → error', (input) => {
    expect(parseDuration(input, undefined)).toBe('error');
  });
});
