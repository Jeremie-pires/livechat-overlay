import os from 'os';
import { getSessionToken, isValidSession } from '../../services/session';
import { getCpuPercent } from '../../services/cpuSampler';
import { presenceStore } from '../../services/presenceStore';

export const StatsRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/stats', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [stats, guildCount, queueCount, latencySamples, botEvents, setupGuilds] = await Promise.all([
        prisma.stats.findUnique({ where: { id: 'singleton' } }),
        prisma.guild.count(),
        prisma.queue.count(),
        prisma.latencySample.findMany({ orderBy: { id: 'desc' }, take: 50 }),
        prisma.botEvent.findMany({ orderBy: { id: 'desc' }, take: 100 }),
        prisma.guild.findMany({ select: { id: true } }),
      ]);

      const setupIds = new Set(setupGuilds.map((g) => g.id));

      const guilds = discordClient.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        icon: g.iconURL({ size: 64 }) ?? null,
        isSetup: setupIds.has(g.id),
      }));

      const latencyCount = stats?.latencyCount ?? 0;
      const avgLatencyMs = latencyCount > 0 ? Math.round((stats?.totalLatencyMs ?? 0) / latencyCount) : 0;

      const ingestionCount = stats?.ingestionCount ?? 0;
      const queueWaitCount = stats?.queueWaitCount ?? 0;
      const processingCount = stats?.processingCount ?? 0;
      const emitCount = stats?.emitCount ?? 0;

      const avgIngestionMs = ingestionCount > 0 ? Math.round((stats?.totalIngestionMs ?? 0) / ingestionCount) : 0;
      const avgQueueWaitMs = queueWaitCount > 0 ? Math.round((stats?.totalQueueWaitMs ?? 0) / queueWaitCount) : 0;
      const avgProcessingMs = processingCount > 0 ? Math.round((stats?.totalProcessingMs ?? 0) / processingCount) : 0;
      const avgEmitMs = emitCount > 0 ? Math.round((stats?.totalEmitMs ?? 0) / emitCount) : 0;

      const orderedSamples = latencySamples.reverse();

      return reply.send({
        silentMode: stats?.silentMode ?? false,
        presence: presenceStore.getAll(),
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
          avgIngestionMs,
          avgQueueWaitMs,
          avgProcessingMs,
          avgEmitMs,
          totalPayloadBytes: stats?.totalPayloadBytes ?? 0,
          samples: orderedSamples.map((s) => s.totalMs),
          queueWaitSamples: orderedSamples.map((s) => s.queueWaitMs),
        },
        guilds,
        events: botEvents,
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
