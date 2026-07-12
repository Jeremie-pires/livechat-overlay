import { describe, it, expect } from 'vitest';
import {
  errMessage,
  assertHttpUrl,
  clampVolume,
  clampOverlaySize,
  MIN_OVERLAY_SIZE,
  MAX_OVERLAY_SIZE,
  isPresenceEntry,
  isPresenceArray,
  normalizeSettings,
  DEFAULT_BACKEND_URL,
} from '../../../desktop-client/src/utils';

describe('errMessage', () => {
  it('returns message for Error instances', () => {
    expect(errMessage(new Error('oops'))).toBe('oops');
  });

  it('stringifies a plain string', () => {
    expect(errMessage('raw string')).toBe('raw string');
  });

  it('stringifies a number', () => {
    expect(errMessage(42)).toBe('42');
  });
});

describe('assertHttpUrl', () => {
  it('accepts http URLs', () => {
    const url = assertHttpUrl('http://localhost:3000');
    expect(url.protocol).toBe('http:');
  });

  it('accepts https URLs', () => {
    const url = assertHttpUrl('https://example.com');
    expect(url.protocol).toBe('https:');
  });

  it('rejects file: URLs', () => {
    expect(() => assertHttpUrl('file:///etc/passwd')).toThrow();
  });

  it('rejects javascript: URLs', () => {
    expect(() => assertHttpUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => assertHttpUrl('')).toThrow();
  });

  it('rejects non-URL strings', () => {
    expect(() => assertHttpUrl('not-a-url')).toThrow();
  });
});

describe('clampVolume', () => {
  it('clamps negative values to 0', () => {
    expect(clampVolume(-10)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(clampVolume(200)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(clampVolume(50.7)).toBe(51);
    expect(clampVolume(50.2)).toBe(50);
  });

  it('passes through values in range', () => {
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(75)).toBe(75);
    expect(clampVolume(100)).toBe(100);
  });
});

describe('clampOverlaySize', () => {
  it('clamps 0 to MIN_OVERLAY_SIZE', () => {
    expect(clampOverlaySize(0)).toBe(MIN_OVERLAY_SIZE);
  });

  it('clamps negative to MIN_OVERLAY_SIZE', () => {
    expect(clampOverlaySize(-500)).toBe(MIN_OVERLAY_SIZE);
  });

  it('clamps above MAX to MAX_OVERLAY_SIZE', () => {
    expect(clampOverlaySize(99999)).toBe(MAX_OVERLAY_SIZE);
  });

  it('rounds fractional values', () => {
    expect(clampOverlaySize(960.7)).toBe(961);
    expect(clampOverlaySize(960.2)).toBe(960);
  });

  it('passes through valid values', () => {
    expect(clampOverlaySize(MIN_OVERLAY_SIZE)).toBe(MIN_OVERLAY_SIZE);
    expect(clampOverlaySize(960)).toBe(960);
    expect(clampOverlaySize(MAX_OVERLAY_SIZE)).toBe(MAX_OVERLAY_SIZE);
  });
});

describe('isPresenceEntry', () => {
  it('accepts a valid entry with avatarUrl null', () => {
    expect(isPresenceEntry({ id: 'u1', displayName: 'Alice', connectedAt: 1000, avatarUrl: null })).toBe(true);
  });

  it('accepts a valid entry with avatarUrl string', () => {
    expect(
      isPresenceEntry({ id: 'u1', displayName: 'Alice', connectedAt: 1000, avatarUrl: 'https://cdn/avatar' }),
    ).toBe(true);
  });

  it('rejects entry with missing id', () => {
    expect(isPresenceEntry({ displayName: 'Alice', connectedAt: 1000, avatarUrl: null })).toBe(false);
  });

  it('rejects entry with empty id', () => {
    expect(isPresenceEntry({ id: '', displayName: 'Alice', connectedAt: 1000, avatarUrl: null })).toBe(false);
  });

  it('rejects null', () => {
    expect(isPresenceEntry(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(isPresenceEntry('string')).toBe(false);
  });

  it('rejects entry with wrong connectedAt type', () => {
    expect(isPresenceEntry({ id: 'u1', displayName: 'Alice', connectedAt: 'now', avatarUrl: null })).toBe(false);
  });

  it('rejects entry with wrong displayName type', () => {
    expect(isPresenceEntry({ id: 'u1', displayName: 42, connectedAt: 1000, avatarUrl: null })).toBe(false);
  });
});

describe('isPresenceArray', () => {
  it('accepts an empty array', () => {
    expect(isPresenceArray([])).toBe(true);
  });

  it('accepts an array of valid entries', () => {
    expect(
      isPresenceArray([
        { id: 'u1', displayName: 'Alice', connectedAt: 1000, avatarUrl: null },
        { id: 'u2', displayName: 'Bob', connectedAt: 2000, avatarUrl: 'https://cdn/b' },
      ]),
    ).toBe(true);
  });

  it('rejects an array containing a malformed entry (missing id)', () => {
    expect(isPresenceArray([{ displayName: 'Alice', connectedAt: 1000, avatarUrl: null }])).toBe(false);
  });

  it('rejects a plain object', () => {
    expect(isPresenceArray({})).toBe(false);
  });

  it('rejects null', () => {
    expect(isPresenceArray(null)).toBe(false);
  });
});

describe('normalizeSettings', () => {
  it('uses DEFAULT_BACKEND_URL when backendUrl is empty', () => {
    expect(normalizeSettings({}).backendUrl).toBe(DEFAULT_BACKEND_URL);
  });

  it('falls back to DEFAULT_BACKEND_URL for javascript: scheme (L3)', () => {
    expect(normalizeSettings({ backendUrl: 'javascript:alert(1)' }).backendUrl).toBe(DEFAULT_BACKEND_URL);
  });

  it('falls back to DEFAULT_BACKEND_URL for file: scheme (L3)', () => {
    expect(normalizeSettings({ backendUrl: 'file:///etc/passwd' }).backendUrl).toBe(DEFAULT_BACKEND_URL);
  });

  it('accepts a valid http backendUrl', () => {
    expect(normalizeSettings({ backendUrl: 'http://my.server:4000' }).backendUrl).toBe('http://my.server:4000');
  });

  it('accepts a valid https backendUrl', () => {
    expect(normalizeSettings({ backendUrl: 'https://prod.server.com' }).backendUrl).toBe('https://prod.server.com');
  });

  it('coerces unknown overlayPosition to center (allowlist)', () => {
    expect(normalizeSettings({ overlayPosition: 'invalid-position' }).overlayPosition).toBe('center');
  });

  it('accepts a valid overlayPosition from the allowlist', () => {
    expect(normalizeSettings({ overlayPosition: 'top-left' }).overlayPosition).toBe('top-left');
    expect(normalizeSettings({ overlayPosition: 'bottom-right' }).overlayPosition).toBe('bottom-right');
  });

  it('trims clientToken whitespace', () => {
    expect(normalizeSettings({ clientToken: '  abc  ' }).clientToken).toBe('abc');
  });

  it('clamps overlaySize to MIN when 0 (L2)', () => {
    expect(normalizeSettings({ overlaySize: 0 }).overlaySize).toBe(MIN_OVERLAY_SIZE);
  });

  it('clamps overlaySize to MAX when very large (L2)', () => {
    expect(normalizeSettings({ overlaySize: 99999 }).overlaySize).toBe(MAX_OVERLAY_SIZE);
  });

  it('passes through a valid overlaySize', () => {
    expect(normalizeSettings({ overlaySize: 960 }).overlaySize).toBe(960);
  });

  it('forces clickThrough to true regardless of input', () => {
    expect(normalizeSettings({ clickThrough: false } as never).clickThrough).toBe(true);
  });
});
