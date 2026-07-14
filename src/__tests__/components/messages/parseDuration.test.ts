import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../../services/utils';

describe('parseDuration (shared helper — sendCommand / hidesendCommand)', () => {
  it('"full" with known mediaDuration rounds up and returns it', () => {
    expect(parseDuration('full', 29.4)).toBe(30);
  });

  it('"full" with null mediaDuration returns 0', () => {
    expect(parseDuration('full', null)).toBe(0);
  });

  it('"full" with undefined mediaDuration returns 0', () => {
    expect(parseDuration('full', undefined)).toBe(0);
  });

  it('valid integer string "30" returns 30', () => {
    expect(parseDuration('30', undefined)).toBe(30);
  });

  it('boundary value "1" is accepted', () => {
    expect(parseDuration('1', undefined)).toBe(1);
  });

  it('boundary value "3600" is accepted', () => {
    expect(parseDuration('3600', undefined)).toBe(3600);
  });

  it('"3601" exceeds max → error', () => {
    expect(parseDuration('3601', undefined)).toBe('error');
  });

  it('"0" is below min → error', () => {
    expect(parseDuration('0', undefined)).toBe('error');
  });

  it('"-5" is below min → error', () => {
    expect(parseDuration('-5', undefined)).toBe('error');
  });

  it('non-numeric string "abc" → error', () => {
    expect(parseDuration('abc', undefined)).toBe('error');
  });

  it('float string "1.5" is truncated by parseInt to 1 → accepted', () => {
    expect(parseDuration('1.5', undefined)).toBe(1);
  });

  it('empty string "" → error', () => {
    expect(parseDuration('', undefined)).toBe('error');
  });
});
