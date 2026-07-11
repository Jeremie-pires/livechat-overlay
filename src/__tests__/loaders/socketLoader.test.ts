import { describe, it, expect } from 'vitest';

const ROOM_PREFIX_PROD = 'production:messages-';
const ROOM_PREFIX_STAGING = 'staging:messages-';

function isValidRoom(roomId: unknown, prefix: string): boolean {
  if (typeof roomId !== 'string') return false;
  if (!roomId.startsWith(prefix)) return false;
  const guildId = roomId.slice(prefix.length);
  return guildId.length > 0 && /^\d+$/.test(guildId);
}

describe('Socket.IO roomId validation', () => {
  describe('production', () => {
    it('accepts valid production room', () => {
      expect(isValidRoom('production:messages-123456789', ROOM_PREFIX_PROD)).toBe(true);
    });

    it('rejects staging room on production server', () => {
      expect(isValidRoom('staging:messages-123456789', ROOM_PREFIX_PROD)).toBe(false);
    });

    it('rejects room with empty guildId', () => {
      expect(isValidRoom('production:messages-', ROOM_PREFIX_PROD)).toBe(false);
    });

    it('rejects room with non-numeric guildId', () => {
      expect(isValidRoom('production:messages-abc', ROOM_PREFIX_PROD)).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidRoom(null, ROOM_PREFIX_PROD)).toBe(false);
    });

    it('rejects object', () => {
      expect(isValidRoom({ id: 'production:messages-123' }, ROOM_PREFIX_PROD)).toBe(false);
    });

    it('rejects arbitrary room', () => {
      expect(isValidRoom('__proto__:messages-123', ROOM_PREFIX_PROD)).toBe(false);
    });
  });

  describe('staging', () => {
    it('accepts valid staging room', () => {
      expect(isValidRoom('staging:messages-987654321', ROOM_PREFIX_STAGING)).toBe(true);
    });

    it('rejects production room on staging server', () => {
      expect(isValidRoom('production:messages-987654321', ROOM_PREFIX_STAGING)).toBe(false);
    });
  });
});

describe('guildId extraction from roomId', () => {
  it('correctly extracts guildId', () => {
    const roomId = 'production:messages-123456789012345678';
    const prefix = 'production:messages-';
    const guildId = roomId.slice(prefix.length);
    expect(guildId).toBe('123456789012345678');
  });
});
