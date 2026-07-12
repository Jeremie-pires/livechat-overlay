import { createHash } from 'crypto';
import { env } from '../services/env';
import { presenceStore } from '../services/presenceStore';
import { presenceSse } from '../services/presenceSse';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const ROOM_PREFIX = `${env.APP_ENV}:messages-`;
const DISCONNECT_DEBOUNCE_MS = 3000;

type JoinRoomPayload = string | { id: string; token?: string };

const disconnectTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; socketId: string }>();

export const loadSocket = (fastify: FastifyCustomInstance) => {
  logger.info(`[Socket] Socket loaded`);
  fastify.io.on('connection', (socket) => {
    logger.debug(`New connection to socketIO :  ${socket.id}`);

    socket.emit('server:env', env.APP_ENV);

    socket.on('disconnecting', () => {
      logger.debug(`New disconnection to socketIO :  ${socket.id}`);
      const entries = presenceStore.getSocketEntries(socket.id);
      for (const { guildId, discordUserId } of entries) {
        const key = `${guildId}:${discordUserId}`;
        const existing = disconnectTimers.get(key);
        if (existing) clearTimeout(existing.timer);

        const capturedSocketId = socket.id;
        const timer = setTimeout(() => {
          disconnectTimers.delete(key);
          presenceStore.removeSocket(capturedSocketId);
          fastify.io.to(`${ROOM_PREFIX}${guildId}`).emit('userLeft', { id: discordUserId });
          presenceSse.push(presenceStore.getAll());
        }, DISCONNECT_DEBOUNCE_MS);

        disconnectTimers.set(key, { timer, socketId: socket.id });
      }
    });

    socket.on('join-room', async (payload: JoinRoomPayload) => {
      const rawId = typeof payload === 'string' ? payload : (payload as Record<string, unknown>)?.id;
      if (typeof rawId !== 'string' || rawId.length === 0 || rawId.length > 200) {
        logger.warn(`[Socket] Invalid join-room payload from ${socket.id}`);
        return;
      }
      const roomId = rawId;
      const token = typeof payload === 'string' ? null : payload.token ?? null;

      if (!roomId.startsWith(ROOM_PREFIX)) {
        logger.warn(`[Socket] Rejected join to unauthorized room: ${roomId} (socket: ${socket.id})`);
        return;
      }

      const guildId = roomId.slice(ROOM_PREFIX.length);
      if (!guildId || !/^\d+$/.test(guildId)) {
        logger.warn(`[Socket] Rejected join with invalid guildId: "${guildId}"`);
        return;
      }

      logger.debug(`Join room :  ${socket.id} -> ${roomId}`);
      socket.join(roomId);

      if (token) {
        try {
          const session = await prisma.clientSession.findUnique({ where: { tokenHash: hashToken(token) } });
          if (session && session.guildId === guildId) {
            let avatarUrl: string | null = null;
            try {
              const user =
                discordClient.users.cache.get(session.discordUserId) ??
                (await discordClient.users.fetch(session.discordUserId));
              avatarUrl = user.avatarURL({ size: 64 }) ?? null;
            } catch {
              // avatar unavailable — fall back to null
            }

            const key = `${guildId}:${session.discordUserId}`;
            const pending = disconnectTimers.get(key);

            if (pending) {
              // Reconnect within debounce window — cancel departure, no delta events emitted
              clearTimeout(pending.timer);
              disconnectTimers.delete(key);
              presenceStore.removeSocket(pending.socketId);
              presenceStore.add(guildId, socket.id, session.discordUserId, session.displayName, avatarUrl);
              socket.emit('presence:update', presenceStore.get(guildId));
            } else {
              presenceStore.add(guildId, socket.id, session.discordUserId, session.displayName, avatarUrl);
              const users = presenceStore.get(guildId);
              const thisUser = users.find((u) => u.id === session.discordUserId);
              const connectedAt = thisUser?.connectedAt ?? Date.now();
              // Send full snapshot to joining socket only
              socket.emit('presence:update', users);
              // Broadcast delta to all other room members
              socket.to(roomId).emit('userJoined', {
                id: session.discordUserId,
                displayName: session.displayName,
                avatarUrl,
                connectedAt,
              });
            }
            presenceSse.push(presenceStore.getAll());
          }
        } catch (err) {
          logger.error(err, '[Socket] Failed to resolve client session for presence');
        }
      }
    });

    socket.on('ping', () => {
      fastify.io.to(socket.id).emit('ping', 'pong');
    });

    socket.on('sync-time', (clientSentAt, callback) => {
      if (typeof callback !== 'function') {
        return;
      }

      callback({
        clientSentAt,
        serverNow: Date.now(),
      });
    });
  });
};
