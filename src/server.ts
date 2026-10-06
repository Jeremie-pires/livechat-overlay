import 'reflect-metadata';
import crypto from 'crypto';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import FastifyRateLimit from '@fastify/rate-limit';
import GracefulServer from '@gquittet/graceful-server';
import { Server as SocketIOServer } from 'socket.io';
import { loadRoutes } from './loaders/RESTLoader';
import { loadSocket } from './loaders/socketLoader';
import { env, validateEnvCoherence } from './services/env';
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
      logger.warn({ origin, allowedOrigin }, '[CORS] Rejected origin');
      callback(null, false);
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

  const redact = {
    paths: [
      '**.DISCORD_TOKEN',
      '**.DISCORD_CLIENT_SECRET',
      '**.access_token',
      '**.client_secret',
      'req.headers.cookie',
      'req.headers.authorization',
      'req.query.code',
    ],
    censor: '[REDACTED]',
  };

  // toISOString() is always UTC — use local date parts so TZ=Europe/Paris is respected
  const toLocalISOString = (d: Date): string => {
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}` +
      `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
    );
  };

  const loggerOptions = isDeployedMode()
    ? {
        level: logLevel,
        base: { env: env.APP_ENV, service: 'livechatccb', version },
        timestamp: () => `,"time":"${toLocalISOString(new Date())}"`,
        redact,
      }
    : { level: logLevel, redact };

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
    trustProxy: isDeployedMode() ? 1 : false,
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

  fastify.setErrorHandler((error, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const expose = statusCode < 500 || !isDeployedMode();
    const message = expose ? error.message : 'Internal Server Error';
    return reply.status(statusCode).send({ statusCode, error: error.name ?? 'Error', message });
  });

  fastify.setNotFoundHandler((req, reply) => {
    req.log.warn({ url: req.url, method: req.method }, '[404] Route not found');
    return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not Found' });
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

  // Attach Socket.IO directly to the underlying HTTP server — no plugin needed.
  // fastify.server is created on Fastify() construction, before listen().
  const io = new SocketIOServer(fastify.server, {
    cors: {
      allowedHeaders: corsAllowedHeaders,
      origin: corsOrigin,
      credentials: true,
    },
  });
  fastify.decorate('io', io);

  // Prevent Fastify's 404 handler from intercepting Socket.IO HTTP-polling requests.
  // reply.hijack() cedes response ownership to socket.io's own Node HTTP listener.
  // Explicit method list avoids fastify.all() iterating http.METHODS which includes non-standard
  // methods (e.g. QUERY in Node 21+) that find-my-way rejects.
  fastify.route({
    method: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    url: '/socket.io/*',
    handler: (_req, reply) => {
      reply.hijack();
    },
  });

  fastify.addHook('onClose', async () => {
    await global.prisma.$disconnect();
    await io.close();
    logger.info({ event: 'shutdown' }, '[SERVER] Connections closed');
  });

  await fastify.register(FastifyCORS, {
    methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
    allowedHeaders: corsAllowedHeaders,
    origin: corsOrigin,
    credentials: true,
  });

  await fastify.register(FastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    // Socket.IO transport requests (polling, WS upgrade) must not count toward the REST
    // rate limit — repeated reconnects from the local OBS proxy would exhaust the budget
    // and cause 429s on subsequent asset requests (SVGs, etc.).
    skip: (req) => (req.url ?? '').startsWith('/socket.io'),
  });

  loadRosetty();
  await loadSocket(fastify);
  await loadRoutes(fastify);
  await loadDiscord(fastify);
  gracefulServer.setReady();

  logger.info({ event: 'boot', appEnv: env.APP_ENV }, '[SERVER] Ready');

  return fastify;
};
