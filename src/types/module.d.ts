/* eslint-disable no-var */
import { Server } from 'http';
import {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import { PrismaClient } from '@prisma/client';

import { Server as ServerSocketIo } from 'socket.io';
import { REST, Client } from 'discord.js';
import { env as ENV } from '../services/env';
import { RosettyI18n } from '../services/i18n/loader';
declare global {
  namespace globalThis {
    var logger: FastifyBaseLogger;
    var env: typeof ENV;
    var discordRest: REST;
    var discordClient: Client;
    var rosetty: RosettyI18n;
    var prisma: PrismaClient;
    var commandsLoaded: string[];
  }

  type FastifyICustom = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<Server>,
    RawReplyDefaultExpression<Server>,
    FastifyBaseLogger
  >;

  interface FastifyCustomInstance extends FastifyICustom, fastifySensible {
    io: ServerSocketIo<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  }
}
