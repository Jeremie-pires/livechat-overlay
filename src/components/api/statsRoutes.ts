import os from 'os';
import { getSessionToken, isValidSession } from '../../services/session';
import { getCpuPercent } from '../../services/cpuSampler';

export const StatsRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/stats', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [stats, guildCount, queueCount, latencySamples] = await Promise.all([
        prisma.stats.findUnique({ where: { id: 'singleton' } }),
        prisma.guild.count(),
        prisma.queue.count(),
        prisma.latencySample.findMany({ orderBy: { id: 'desc' }, take: 50 }),
      ]);

      const guilds = discordClient.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        icon: g.iconURL({ size: 64 }) ?? null,
      }));

      const latencyCount = stats?.latencyCount ?? 0;
      const avgLatencyMs = latencyCount > 0 ? Math.round((stats?.totalLatencyMs ?? 0) / latencyCount) : 0;

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
        latency: {
          avgMs: avgLatencyMs,
          totalPayloadBytes: stats?.totalPayloadBytes ?? 0,
          samples: latencySamples.reverse().map((s) => s.latencyMs),
        },
        guilds,
        system: {
          cpuPercent: getCpuPercent(),
          loadAvg: os.loadavg(),
          memTotalMB: Math.round(os.totalmem() / 1024 / 1024),
          memFreeMB: Math.round(os.freemem() / 1024 / 1024),
          memRssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
          memHeapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          memHeapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });
    });
  };
