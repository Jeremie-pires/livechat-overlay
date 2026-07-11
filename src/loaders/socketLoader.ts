import { createHash } from 'crypto';
import { env } from '../services/env';
import { presenceStore } from '../services/presenceStore';
import { presenceSse } from '../services/presenceSse';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const ROOM_PREFIX = `${env.APP_ENV}:messages-`;

type JoinRoomPayload = string | { id: string; token?: string };

export const loadSocket = (fastify: FastifyCustomInstance) => {
  logger.info(`[Socket] Socket loaded`);
  fastify.io.on('connection', (socket) => {
    logger.debug(`New connection to socketIO :  ${socket.id}`);

    socket.emit('server:env', env.APP_ENV);

    socket.on('disconnecting', () => {
      logger.debug(`New disconnection to socketIO :  ${socket.id}`);
      const affected = presenceStore.removeSocket(socket.id);
      for (const guildId of affected) {
        const updated = presenceStore.get(guildId);
        fastify.io.to(`${ROOM_PREFIX}${guildId}`).emit('presence:update', updated);
        presenceSse.push(presenceStore.getAll());
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
            presenceStore.add(guildId, socket.id, session.discordUserId, session.displayName, avatarUrl);
            const updated = presenceStore.get(guildId);
            fastify.io.to(roomId).emit('presence:update', updated);
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
