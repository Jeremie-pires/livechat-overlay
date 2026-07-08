import { getSessionToken, isValidSession } from '../../services/session';

export const StatsRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/stats', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [stats, guildCount, queueCount] = await Promise.all([
        prisma.stats.findUnique({ where: { id: 'singleton' } }),
        prisma.guild.count(),
        prisma.queue.count(),
      ]);

      return reply.send({
        servers: guildCount,
        queuePending: queueCount,
        uptime: Math.floor(process.uptime()),
        totalSent: stats?.totalSent ?? 0,
        byType: {
          image: stats?.imageCount ?? 0,
          video: stats?.videoCount ?? 0,
          audio: stats?.audioCount ?? 0,
          link: stats?.linkCount ?? 0,
          text: stats?.textCount ?? 0,
        },
      });
    });
  };
