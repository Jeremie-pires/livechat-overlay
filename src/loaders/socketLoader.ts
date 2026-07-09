import { createHash } from 'crypto';
import { presenceStore } from '../services/presenceStore';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

type JoinRoomPayload = string | { id: string; token?: string };

export const loadSocket = (fastify: FastifyCustomInstance) => {
  logger.info(`[Socket] Socket loaded`);
  fastify.io.on('connection', (socket) => {
    logger.debug(`New connection to socketIO :  ${socket.id}`);

    socket.on('disconnecting', () => {
      logger.debug(`New disconnection to socketIO :  ${socket.id}`);
      const affected = presenceStore.removeSocket(socket.id);
      for (const guildId of affected) {
        fastify.io.to(`messages-${guildId}`).emit('presence:update', presenceStore.get(guildId));
      }
    });

    socket.on('join-room', async (payload: JoinRoomPayload) => {
      const roomId = typeof payload === 'string' ? payload : payload.id;
      const token = typeof payload === 'string' ? null : (payload.token ?? null);

      logger.debug(`Join room :  ${socket.id} -> ${roomId}`);
      socket.join(roomId);

      if (token && roomId.startsWith('messages-')) {
        const guildId = roomId.slice('messages-'.length);
        try {
          const session = await prisma.clientSession.findUnique({ where: { tokenHash: hashToken(token) } });
          if (session && session.guildId === guildId) {
            let avatarUrl: string | null = null;
            try {
              const user = discordClient.users.cache.get(session.discordUserId)
                ?? await discordClient.users.fetch(session.discordUserId);
              avatarUrl = user.avatarURL({ size: 64 }) ?? null;
            } catch {
              // avatar unavailable — fall back to null
            }
            presenceStore.add(guildId, socket.id, session.displayName, avatarUrl);
            fastify.io.to(roomId).emit('presence:update', presenceStore.get(guildId));
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
