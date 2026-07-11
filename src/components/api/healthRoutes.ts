export const HealthRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/health', { config: { skipRequestLogging: true } }, async (_req, reply) => {
      return reply.send({ status: 'ok', env: global.env.APP_ENV, uptime: Math.floor(process.uptime()) });
    });

    fastify.get('/health/ready', { config: { skipRequestLogging: true } }, async (_req, reply) => {
      const checks: Record<string, { ok: boolean; reason?: string }> = {};

      try {
        await global.prisma.$queryRaw`SELECT 1`;
        checks.db = { ok: true };
      } catch (err) {
        fastify.log.error(err, '[HEALTH] Prisma readiness probe failed');
        const code = (err as Record<string, unknown>).code;
        const reason = typeof code === 'string' ? `Database connection failed (${code})` : 'Database connection failed';
        checks.db = { ok: false, reason };
      }

      const discordReady = global.discordClient?.isReady() ?? false;
      checks.discord = discordReady ? { ok: true } : { ok: false, reason: 'Discord client not ready' };

      const allOk = Object.values(checks).every((c) => c.ok);
      return reply.status(allOk ? 200 : 503).send({ status: allOk ? 'ok' : 'degraded', checks });
    });
  };
