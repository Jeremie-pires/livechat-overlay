/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import crypto from 'crypto';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import GracefulServer from '@gquittet/graceful-server';
import unifyFastifyPlugin from 'unify-fastify';
import { loadRoutes } from './loaders/RESTLoader';
import { loadSocket } from './loaders/socketLoader';
import { env, isProductionEnv, isPreProductionEnv, validateEnvCoherence } from './services/env';
import { loadDiscord } from './loaders/DiscordLoader';
import { loadRosetty } from './services/i18n/loader';
import { loadPrismaClient } from './services/prisma/loadPrisma';
import './services/cpuSampler';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string };

const isDeployedMode = () => env.APP_ENV === 'production' || env.APP_ENV === 'staging';

export const runServer = async () => {
  validateEnvCoherence();

  const allowedOrigin = new URL(env.API_URL).origin;

  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'), false);
    }
  };

  const corsAllowedHeaders = [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'forest-context-url',
    'Set-Cookie',
    'set-cookie',
    'Cookie',
  ];

  const logLevel = env.LOG || 'info';

  const loggerOptions = isDeployedMode()
    ? {
        level: logLevel,
        base: { env: env.APP_ENV, service: 'livechatccb', version },
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        redact: {
          paths: [
            'DISCORD_TOKEN',
            'DISCORD_CLIENT_SECRET',
            '*.DISCORD_TOKEN',
            '*.DISCORD_CLIENT_SECRET',
            'req.headers.cookie',
            'req.headers.authorization',
          ],
          censor: '[REDACTED]',
        },
      }
    : { level: logLevel };

  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const resolveCorrelationId = (header: string | string[] | undefined): string => {
    if (typeof header === 'string' && UUID_V4_RE.test(header)) return header;
    return crypto.randomUUID();
  };

  //@ts-ignore
  const fastify: FastifyCustomInstance = Fastify({
    logger: loggerOptions,
    disableRequestLogging: true,
    genReqId: (req) => resolveCorrelationId(req.headers['x-request-id']),
    trustProxy: true,
  });

  const logger = fastify.log;
  global.logger = logger;

  fastify.addHook('onRequest', (req, _reply, done) => {
    req.log = req.log.child({ correlation_id: req.id });
    done();
  });

  fastify.addHook('onSend', (_req, reply, _payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isDeployedMode()) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    done();
  });

  await fastify.register(unifyFastifyPlugin, {
    disableDetails: isProductionEnv() || isPreProductionEnv(),
  });

  const gracefulServer = GracefulServer(fastify.server);
  gracefulServer.on(GracefulServer.SHUTTING_DOWN, (err) => {
    if (err) {
      logger.debug(err);
    }
    logger.info({ event: 'shutdown' }, '[SERVER] Shutting down');
  });

  try {
    await loadPrismaClient();
    logger.info('[DB] Connected to database');
  } catch (e) {
    logger.fatal(e, '[DB] Impossible to connect to database');
    process.exit(1);
  }

  try {
    await fastify.register(require('fastify-socket.io'), {
      cors: {
        allowedHeaders: corsAllowedHeaders,
        origin: corsOrigin,
        credentials: true,
      },
    });
  } catch (error) {
    logger.fatal(error, '[SERVER] Failed to register socket.io');
  }

  // Prevent unify-fastify's 404 handler from intercepting Socket.IO HTTP-polling requests.
  // reply.hijack() cedes response ownership to socket.io's own Node HTTP listener.
  fastify.all('/socket.io/*', (_req, reply) => {
    reply.hijack();
  });

  fastify.addHook('onClose', async () => {
    await global.prisma.$disconnect();
    await fastify.io?.close();
    logger.info({ event: 'shutdown' }, '[SERVER] Connections closed');
  });

  await fastify.register(FastifyCORS, {
    methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
    allowedHeaders: corsAllowedHeaders,
    origin: corsOrigin,
    credentials: true,
  });

  loadRosetty();
  await loadSocket(fastify);
  await loadRoutes(fastify);
  await loadDiscord(fastify);
  gracefulServer.setReady();

  logger.info({ event: 'boot', appEnv: env.APP_ENV }, '[SERVER] Ready');

  return fastify;
};
