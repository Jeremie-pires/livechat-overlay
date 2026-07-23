import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as socketIoClient, type Socket as ClientSocket } from 'socket.io-client';
import { assertHttpUrl, type AppSettings } from './utils';

let httpServer: ReturnType<typeof createServer> | null = null;
let localIo: SocketIOServer | null = null;
let remoteSocket: ClientSocket | null = null;
let activePort = 3001;
let activeEnv = 'production';
let activeGuildId = '';

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

async function proxyAsset(req: IncomingMessage, res: ServerResponse, remoteBase: string): Promise<void> {
  try {
    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
    if (!reqUrl.pathname.startsWith('/client')) {
      res.writeHead(404);
      res.end();
      return;
    }
    const upstream = await fetch(`${remoteBase}${reqUrl.pathname}${reqUrl.search}`);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.writeHead(upstream.status);
    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.writeHead(502);
    res.end();
  }
}

export function getLocalObsUrl(): string {
  if (!activeGuildId) return '';
  return `http://localhost:${activePort}/client?guildId=${encodeURIComponent(activeGuildId)}`;
}

export async function startLocalServer(settings: AppSettings): Promise<void> {
  await stopLocalServer();

  const remoteBase = assertHttpUrl(settings.backendUrl).href.replace(/\/$/, '');
  activeGuildId = settings.guildId;
  activeEnv = 'production';

  let port = settings.localServerPort ?? 3001;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (await isPortAvailable(port)) break;
    port += 1;
  }
  activePort = port;

  const server = createServer(async (req, res) => {
    if ((req.url ?? '').startsWith('/socket.io')) return;
    res.setHeader('Access-Control-Allow-Origin', '*');
    await proxyAsset(req, res, remoteBase);
  });

  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    socket.emit('server:env', activeEnv);

    socket.on('join-room', (payload: string | { id: string; token?: string }) => {
      const roomId = typeof payload === 'string' ? payload : payload?.id;
      if (typeof roomId === 'string' && roomId.length > 0 && roomId.length <= 200) {
        void socket.join(roomId);
      }
    });

    socket.on('sync-time', (clientSentAt: number, callback: unknown) => {
      if (typeof callback === 'function') {
        (callback as (d: { clientSentAt: number; serverNow: number }) => void)({
          clientSentAt,
          serverNow: Date.now(),
        });
      }
    });

    socket.on('ping', () => {
      socket.emit('ping', 'pong');
    });
  });

  const remote = socketIoClient(remoteBase, {
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
  });

  remote.on('server:env', (serverEnv: string) => {
    activeEnv = serverEnv;
    io.emit('server:env', serverEnv);
    const roomId = `${serverEnv}:messages-${settings.guildId}`;
    const joinPayload = settings.clientToken
      ? { id: roomId, token: settings.clientToken }
      : roomId;
    remote.emit('join-room', joinPayload);
  });

  remote.on('new-message', (data: unknown) => {
    io.to(`${activeEnv}:messages-${settings.guildId}`).emit('new-message', data);
  });

  remote.on('stop', () => {
    io.to(`${activeEnv}:messages-${settings.guildId}`).emit('stop');
  });

  remote.on('connect_error', (err: Error) => {
    console.error('[LocalServer] Remote connection error:', err.message);
  });

  httpServer = server;
  localIo = io;
  remoteSocket = remote;

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  console.info(
    `[LocalServer] OBS server → http://localhost:${port}/client?guildId=${encodeURIComponent(settings.guildId)}`,
  );
}

export async function stopLocalServer(): Promise<void> {
  remoteSocket?.disconnect();
  remoteSocket = null;
  localIo?.close();
  localIo = null;
  await new Promise<void>((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close(() => resolve());
    httpServer = null;
  });
}
