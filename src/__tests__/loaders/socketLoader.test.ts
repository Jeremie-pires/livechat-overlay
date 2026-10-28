import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/env', () => ({
  env: { APP_ENV: 'production' },
}));

vi.mock('../../services/session', () => ({
  hashToken: vi.fn((t: string) => `hash:${t}`),
}));

vi.mock('../../services/presenceStore', () => ({
  presenceStore: {
    getSocketEntries: vi.fn().mockReturnValue([]),
    add: vi.fn(),
    get: vi.fn().mockReturnValue([]),
    removeSocket: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../services/presenceSse', () => ({
  presenceSse: { push: vi.fn() },
}));

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

// ── join-room token auth (audit — socket auth required before join) ───────────

describe('loadSocket — join-room token auth', () => {
  type MockPrisma = {
    stats: { findUnique: ReturnType<typeof vi.fn> };
    clientSession: { findUnique: ReturnType<typeof vi.fn> };
  };
  let connectionHandler: ((socket: unknown) => void) | null = null;
  let joinRoomHandler: ((payload: unknown) => Promise<void>) | null = null;
  let socketJoin: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.fn>;
  let clientSessionFindUnique: ReturnType<typeof vi.fn>;
  let socketCounter = 0;

  beforeAll(async () => {
    const mockPrisma: MockPrisma = {
      stats: { findUnique: vi.fn().mockResolvedValue(null) },
      clientSession: { findUnique: vi.fn() },
    };
    (global as Record<string, unknown>).prisma = mockPrisma;
    (global as Record<string, unknown>).discordClient = {
      users: {
        cache: { get: vi.fn().mockReturnValue(null) },
        fetch: vi.fn().mockResolvedValue({ avatarURL: () => null }),
      },
      isReady: () => true,
    };

    const mockFastifyIo = {
      on: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };
    (global as Record<string, unknown>).logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { loadSocket } = await import('../../loaders/socketLoader');
    loadSocket({ io: mockFastifyIo } as unknown as FastifyCustomInstance);
    connectionHandler = (mockFastifyIo.on.mock.calls[0] as [string, (s: unknown) => void])[1];
    clientSessionFindUnique = mockPrisma.clientSession.findUnique;
  });

  beforeEach(() => {
    socketCounter++;
    socketJoin = vi.fn();
    warnSpy = vi.fn();
    (global as Record<string, unknown>).logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: warnSpy,
      error: vi.fn(),
    };

    const socket = {
      id: `test-socket-${socketCounter}`,
      on: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'join-room') joinRoomHandler = cb as (p: unknown) => Promise<void>;
      }),
      emit: vi.fn(),
      join: socketJoin,
    };
    connectionHandler!(socket);
    clientSessionFindUnique.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('no token → socket.join not called, warn logged', async () => {
    await joinRoomHandler!({ id: 'production:messages-123456789' });
    expect(socketJoin).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('token required'));
  });

  it('string payload (legacy, no token field) → socket.join not called', async () => {
    await joinRoomHandler!('production:messages-123456789');
    expect(socketJoin).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('token required'));
  });

  it('token not found in DB (null session) → socket.join not called', async () => {
    clientSessionFindUnique.mockResolvedValue(null);
    await joinRoomHandler!({ id: 'production:messages-123456789', token: 'unknown' });
    expect(socketJoin).not.toHaveBeenCalled();
  });

  it('token belongs to different guild → socket.join not called', async () => {
    clientSessionFindUnique.mockResolvedValue({ guildId: '999999999', discordUserId: 'u1', displayName: 'X' });
    await joinRoomHandler!({ id: 'production:messages-123456789', token: 'tok' });
    expect(socketJoin).not.toHaveBeenCalled();
  });

  it('valid token + correct guild → socket.join called with roomId', async () => {
    clientSessionFindUnique.mockResolvedValue({ guildId: '123456789', discordUserId: 'u1', displayName: 'User1' });
    await joinRoomHandler!({ id: 'production:messages-123456789', token: 'valid-token' });
    expect(socketJoin).toHaveBeenCalledWith('production:messages-123456789');
  });

  it('hashToken is called with the provided token string', async () => {
    const { hashToken } = await import('../../services/session');
    clientSessionFindUnique.mockResolvedValue({ guildId: '123456789', discordUserId: 'u1', displayName: 'U' });
    await joinRoomHandler!({ id: 'production:messages-123456789', token: 'mytoken' });
    expect(vi.mocked(hashToken)).toHaveBeenCalledWith('mytoken');
  });
});
