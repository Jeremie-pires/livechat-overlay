import { getSessionToken, isValidSession } from '../../services/session';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export const AdminDbRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/db/guilds', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) return reply.status(401).send({ error: 'Unauthorized' });

      const guilds = await prisma.guild.findMany();

      const broadcastLogs =
        guilds.length > 0
          ? await prisma.broadcastLog.findMany({
              where: { guildId: { in: guilds.map((g) => g.id) } },
              orderBy: { createdAt: 'desc' },
              select: { guildId: true, status: true, errorReason: true, createdAt: true },
            })
          : [];

      const lastBroadcastByGuild = new Map<string, (typeof broadcastLogs)[number]>();
      for (const log of broadcastLogs) {
        if (!lastBroadcastByGuild.has(log.guildId)) {
          lastBroadcastByGuild.set(log.guildId, log);
        }
      }

      const rows = guilds.map((guild) => {
        const discordGuild = discordClient.guilds.cache.get(guild.id);
        const logEntry = lastBroadcastByGuild.get(guild.id);
        return {
          id: guild.id,
          name: discordGuild?.name ?? guild.id,
          icon: discordGuild?.iconURL({ size: 64 }) ?? null,
          channelId: guild.channelId,
          defaultMediaTime: guild.defaultMediaTime,
          maxMediaTime: guild.maxMediaTime,
          displayMediaFull: guild.displayMediaFull,
          connected: !!discordGuild,
          lastBroadcast: logEntry
            ? { status: logEntry.status, errorReason: logEntry.errorReason, at: logEntry.createdAt }
            : null,
        };
      });

      return reply.send(rows);
    });

    fastify.delete('/db/guilds/:id', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) return reply.status(401).send({ error: 'Unauthorized' });

      const { id } = req.params as { id: string };
      if (!SNOWFLAKE_RE.test(id)) return reply.status(400).send({ error: 'Invalid guild ID format' });

      const existing = await prisma.guild.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'Guild not found' });

      await prisma.guild.delete({ where: { id } });
      await prisma.botEvent.create({ data: { type: 'DB_PURGE', message: `Guild ${id} purged from DB` } });

      return reply.send({ ok: true, deletedId: id });
    });

    fastify.get('/db/broadcasts/latest', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) return reply.status(401).send({ error: 'Unauthorized' });

      const latestLog = await prisma.broadcastLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { runId: true, createdAt: true },
      });

      if (!latestLog) return reply.send({ runId: null, total: 0, succeeded: 0, failed: 0, rows: [] });

      const rows = await prisma.broadcastLog.findMany({
        where: { runId: latestLog.runId },
        orderBy: { createdAt: 'asc' },
      });

      const succeeded = rows.filter((r) => r.status === 'SUCCESS').length;
      const failed = rows.filter((r) => r.status === 'FAILED').length;

      return reply.send({
        runId: latestLog.runId,
        at: latestLog.createdAt,
        total: rows.length,
        succeeded,
        failed,
        rows,
      });
    });
  };
