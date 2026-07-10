import { ServerResponse } from 'http';

type PublicPresenceEntry = { displayName: string; connectedAt: number; avatarUrl: string | null };

const clients = new Set<ServerResponse>();

export const presenceSse = {
  register(res: ServerResponse): void {
    clients.add(res);
    res.on('close', () => clients.delete(res));
  },

  push(presence: Record<string, PublicPresenceEntry[]>): void {
    if (clients.size === 0) return;
    const payload = `event: presence\ndata: ${JSON.stringify(presence)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch {
        clients.delete(res);
      }
    }
  },
};
