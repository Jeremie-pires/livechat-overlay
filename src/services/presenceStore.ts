type PresenceEntry = { displayName: string; connectedAt: number; avatarUrl: string | null };

const store = new Map<string, Map<string, PresenceEntry>>();

export const presenceStore = {
  add(guildId: string, socketId: string, displayName: string, avatarUrl: string | null): void {
    if (!store.has(guildId)) store.set(guildId, new Map());
    store.get(guildId)!.set(socketId, { displayName, connectedAt: Date.now(), avatarUrl });
  },

  removeSocket(socketId: string): string[] {
    const affected: string[] = [];
    for (const [guildId, sockets] of store) {
      if (sockets.delete(socketId)) {
        affected.push(guildId);
        if (sockets.size === 0) store.delete(guildId);
      }
    }
    return affected;
  },

  get(guildId: string): PresenceEntry[] {
    const sockets = store.get(guildId);
    if (!sockets) return [];
    return Array.from(sockets.values());
  },

  getAll(): Record<string, PresenceEntry[]> {
    const result: Record<string, PresenceEntry[]> = {};
    for (const [guildId, sockets] of store) {
      result[guildId] = Array.from(sockets.values());
    }
    return result;
  },
};
