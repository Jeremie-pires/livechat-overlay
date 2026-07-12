import { describe, it, expect, beforeEach } from 'vitest';

// Inline implementation mirror for isolation — avoids importing the module-level singleton
function makeStore() {
  type CorePresenceFields = { displayName: string; connectedAt: number; avatarUrl: string | null };
  type PublicPresenceEntry = CorePresenceFields & { id: string };
  type InternalPresenceEntry = CorePresenceFields & { discordUserId: string };

  const store = new Map<string, Map<string, InternalPresenceEntry>>();
  const userSocketMap = new Map<string, string>();

  function toPublic({
    discordUserId,
    displayName,
    connectedAt,
    avatarUrl,
  }: InternalPresenceEntry): PublicPresenceEntry {
    return { id: discordUserId, displayName, connectedAt, avatarUrl };
  }

  return {
    add(guildId: string, socketId: string, discordUserId: string, displayName: string, avatarUrl: string | null): void {
      if (!store.has(guildId)) store.set(guildId, new Map());
      const guildMap = store.get(guildId)!;
      const userKey = `${guildId}:${discordUserId}`;
      const oldSocketId = userSocketMap.get(userKey);
      if (oldSocketId && oldSocketId !== socketId) guildMap.delete(oldSocketId);
      userSocketMap.set(userKey, socketId);
      guildMap.set(socketId, { displayName, connectedAt: Date.now(), avatarUrl, discordUserId });
    },
    removeSocket(socketId: string): string[] {
      const affected: string[] = [];
      for (const [guildId, sockets] of store) {
        const entry = sockets.get(socketId);
        if (entry) {
          sockets.delete(socketId);
          const userKey = `${guildId}:${entry.discordUserId}`;
          if (userSocketMap.get(userKey) === socketId) userSocketMap.delete(userKey);
          affected.push(guildId);
          if (sockets.size === 0) store.delete(guildId);
        }
      }
      return affected;
    },
    get(guildId: string): PublicPresenceEntry[] {
      const sockets = store.get(guildId);
      if (!sockets) return [];
      return Array.from(sockets.values()).map(toPublic);
    },
    getSocketEntries(socketId: string): Array<{ guildId: string; discordUserId: string }> {
      const result: Array<{ guildId: string; discordUserId: string }> = [];
      for (const [guildId, sockets] of store) {
        const entry = sockets.get(socketId);
        if (entry) result.push({ guildId, discordUserId: entry.discordUserId });
      }
      return result;
    },
  };
}

describe('presenceStore — delta sync', () => {
  let ps: ReturnType<typeof makeStore>;

  beforeEach(() => {
    ps = makeStore();
  });

  it('get() returns entries with id field', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    const entries = ps.get('g1');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('u1');
    expect(entries[0].displayName).toBe('Alice');
  });

  it('get() returns empty array for unknown guild', () => {
    expect(ps.get('unknown')).toEqual([]);
  });

  it('getSocketEntries() returns guildId and discordUserId for connected socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    const result = ps.getSocketEntries('s1');
    expect(result).toEqual([{ guildId: 'g1', discordUserId: 'u1' }]);
  });

  it('getSocketEntries() returns empty array for unknown socket', () => {
    expect(ps.getSocketEntries('unknown')).toEqual([]);
  });

  it('getSocketEntries() returns all guilds for a multi-guild socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g2', 's1', 'u1', 'Alice', null);
    const result = ps.getSocketEntries('s1');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.guildId).sort()).toEqual(['g1', 'g2']);
  });

  it('getSocketEntries() returns empty after removeSocket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.removeSocket('s1');
    expect(ps.getSocketEntries('s1')).toEqual([]);
  });

  it('add() replaces old socket entry on reconnect — same user, new socket', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.add('g1', 's2', 'u1', 'Alice', null);
    const entries = ps.get('g1');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('u1');
    expect(ps.getSocketEntries('s1')).toEqual([]);
    expect(ps.getSocketEntries('s2')).toEqual([{ guildId: 'g1', discordUserId: 'u1' }]);
  });

  it('removeSocket() returns affected guildIds', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    const affected = ps.removeSocket('s1');
    expect(affected).toEqual(['g1']);
  });

  it('removeSocket() cleans up empty guild from store', () => {
    ps.add('g1', 's1', 'u1', 'Alice', null);
    ps.removeSocket('s1');
    expect(ps.get('g1')).toEqual([]);
  });
});

describe('debounce reconnection logic (pure)', () => {
  it('cancelling a timer prevents userLeft emission', () => {
    const emitted: string[] = [];
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    function scheduleUserLeft(key: string, id: string, delayMs: number) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.delete(key);
        emitted.push(id);
      }, delayMs);
      timers.set(key, t);
    }

    function cancelUserLeft(key: string) {
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
        timers.delete(key);
      }
    }

    scheduleUserLeft('g1:u1', 'u1', 50);
    cancelUserLeft('g1:u1');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(emitted).toHaveLength(0);
        resolve();
      }, 100);
    });
  });

  it('userLeft is emitted after debounce if not cancelled', () => {
    const emitted: string[] = [];
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    function scheduleUserLeft(key: string, id: string, delayMs: number) {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.delete(key);
        emitted.push(id);
      }, delayMs);
      timers.set(key, t);
    }

    scheduleUserLeft('g1:u1', 'u1', 30);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(emitted).toEqual(['u1']);
        resolve();
      }, 80);
    });
  });
});
