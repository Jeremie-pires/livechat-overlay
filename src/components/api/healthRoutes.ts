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
        const msg = err instanceof Error ? err.message : String(err);
        checks.db = { ok: false, reason: msg };
      }

      const discordReady = global.discordClient?.isReady() ?? false;
      checks.discord = discordReady ? { ok: true } : { ok: false, reason: 'Discord client not ready' };

      const allOk = Object.values(checks).every((c) => c.ok);
      return reply.status(allOk ? 200 : 503).send({ status: allOk ? 'ok' : 'degraded', checks });
    });
  };
