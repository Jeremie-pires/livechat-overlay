import { runServer } from './server';
import { env } from './services/env';
import { logBotEvent, notifyOwner } from './services/botLogger';

process.on('uncaughtException', async (err) => {
  if (global.logger) global.logger.fatal(err, '[PROCESS] uncaughtException');
  await Promise.allSettled([
    logBotEvent('CRASH', `uncaughtException: ${err.message}`),
    notifyOwner('CRASH', `uncaughtException: ${err.message}`),
  ]);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (global.logger) global.logger.fatal(reason as Error, '[PROCESS] unhandledRejection');
  await Promise.allSettled([
    logBotEvent('CRASH', `unhandledRejection: ${msg}`),
    notifyOwner('CRASH', `unhandledRejection: ${msg}`),
  ]);
  process.exit(1);
});

(async () => {
  global.env = env;
  Object.assign(process.env, env);

  const port: number = env.PORT ? env.PORT : 3000;

  const fastify = await runServer();

  fastify.ready(async () => {});
  fastify.listen({ port, host: '::', listenTextResolver: () => `[SERVER] ${rosetty.t('serverStarted')!}` }, (err) => {
    if (err) {
      logger.fatal(`${err}`);
      process.exit(1);
    }
  });
})();
