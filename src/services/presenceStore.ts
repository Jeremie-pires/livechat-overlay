type PublicPresenceEntry = { id: string; displayName: string; connectedAt: number; avatarUrl: string | null };
type InternalPresenceEntry = PublicPresenceEntry & { discordUserId: string };

const store = new Map<string, Map<string, InternalPresenceEntry>>();
const userSocketMap = new Map<string, string>(); // `${guildId}:${discordUserId}` → socketId

function toPublic({ discordUserId, displayName, connectedAt, avatarUrl }: InternalPresenceEntry): PublicPresenceEntry {
  return { id: discordUserId, displayName, connectedAt, avatarUrl };
}

export const presenceStore = {
  add(guildId: string, socketId: string, discordUserId: string, displayName: string, avatarUrl: string | null): void {
    if (!store.has(guildId)) store.set(guildId, new Map());
    const guildMap = store.get(guildId)!;

    const userKey = `${guildId}:${discordUserId}`;
    const oldSocketId = userSocketMap.get(userKey);
    if (oldSocketId && oldSocketId !== socketId) {
      guildMap.delete(oldSocketId);
    }
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

  getAll(): Record<string, PublicPresenceEntry[]> {
    const result: Record<string, PublicPresenceEntry[]> = {};
    for (const [guildId, sockets] of store) {
      result[guildId] = Array.from(sockets.values()).map(toPublic);
    }
    return result;
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
