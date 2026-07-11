import { startCase } from 'lodash';
import { ClientRoutes } from '../components/client/clientRoutes';
import { StatsRoutes } from '../components/api/statsRoutes';
import { HealthRoutes } from '../components/api/healthRoutes';
import { DashboardRoutes } from '../components/dashboard/dashboardRoutes';

export const loadRoutes = (fastify: FastifyCustomInstance) => {
  const routes = [{ '/client': ClientRoutes }, { '/api': StatsRoutes }, { '/': DashboardRoutes }];

  fastify.register(HealthRoutes(), { prefix: '/' });
  logger.info('[REST] Health Routes loaded (/health, /health/ready)');


  for (const route of routes) {
    const [[prefix, fastifyRoutes]] = Object.entries(route);
    //@ts-ignore
    fastify.register(fastifyRoutes(fastify.io), { prefix });
    const routeName = startCase(prefix.substring(1).replaceAll('/', ' '));
    logger.info(`[REST] ${routeName} Routes loaded (${prefix})`);
  }
};
