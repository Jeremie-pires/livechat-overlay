import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';
import {
  createCsrfToken,
  createSession,
  deleteSession,
  getSessionToken,
  isValidSession,
  validateCsrfToken,
} from '../../services/session';
import { broadcastToAllGuilds } from '../../services/broadcast';
import { presenceStore } from '../../services/presenceStore';
import { presenceSse } from '../../services/presenceSse';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const DISCORD_API = 'https://discord.com/api/v10';

const DIR = join(process.cwd(), 'src/components/dashboard');
const DASHBOARD_HTML = readFileSync(join(DIR, 'dashboard.html'), 'utf-8');
const DASHBOARD_CSS = readFileSync(join(DIR, 'dashboard.css'), 'utf-8');
const DASHBOARD_JS = readFileSync(join(DIR, 'dashboard.js'), 'utf-8');

async function dashboardPlugin(fastify: FastifyCustomInstance) {
  const redirectUri = `${env.API_URL}/auth/callback`;
  const oauthUrl =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${env.DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=identify`;
  const secureFlag = env.APP_ENV !== 'development' ? '; Secure' : '';

  fastify.get('/dashboard.css', (_, reply) => reply.type('text/css').send(DASHBOARD_CSS));
  fastify.get('/dashboard.js', (_, reply) => reply.type('application/javascript').send(DASHBOARD_JS));

  fastify.get('/dashboard', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (!isValidSession(token)) {
      const state = randomBytes(16).toString('hex');
      const fullOauthUrl = `${oauthUrl}&state=${state}`;
      reply.header('Set-Cookie', `oauth_state=${state}; HttpOnly${secureFlag}; Path=/; SameSite=Lax; Max-Age=300`);
      const redirectPage = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script>window.top.location.href=${JSON.stringify(fullOauthUrl)};</script></head><body></body></html>`;
      return reply.type('text/html').send(redirectPage);
    }
    const csrfToken = createCsrfToken(token!);
    return reply.type('text/html').send(DASHBOARD_HTML.replace('{{CSRF_TOKEN}}', csrfToken));
  });

  fastify.get('/auth/callback', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code) return reply.status(400).send('Missing code');

    const cookieHeader = req.headers.cookie;
    const oauthStateCookie = cookieHeader
      ?.split(';')
      .find((c) => c.trim().startsWith('oauth_state='))
      ?.split('=')
      .slice(1)
      .join('=')
      .trim();
    reply.header('Set-Cookie', `oauth_state=; HttpOnly${secureFlag}; Path=/; SameSite=Lax; Max-Age=0`);
    if (!state || !oauthStateCookie || state !== oauthStateCookie) {
      logger.warn('[DASHBOARD] OAuth CSRF state mismatch — possible CSRF attack');
      return reply.status(403).send('Invalid state parameter');
    }

    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      logger.error('[DASHBOARD] OAuth token exchange failed');
      return reply.status(401).send('Authentication failed');
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return reply.status(401).send('Failed to get user info');
    }

    const user = (await userRes.json()) as { id: string };

    if (!env.DISCORD_OWNER_ID || user.id !== env.DISCORD_OWNER_ID) {
      logger.warn(`[DASHBOARD] Unauthorized access attempt by Discord user ${user.id}`);
      return reply.status(403).send('Access denied');
    }

    const sessionToken = createSession();
    reply.header('Set-Cookie', `session=${sessionToken}; HttpOnly${secureFlag}; Path=/; SameSite=Lax; Max-Age=604800`);
    return reply.redirect('/dashboard', 302);
  });

  fastify.post('/api/maintenance/toggle', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (!isValidSession(token)) return reply.status(401).send({ error: 'Unauthorized' });
    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (!validateCsrfToken(token, csrfToken)) return reply.status(403).send({ error: 'Invalid CSRF token' });

    const stats = await prisma.stats.findUnique({ where: { id: 'singleton' } });
    const silentMode = !(stats?.silentMode ?? false);

    await prisma.stats.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', silentMode },
      update: { silentMode },
    });

    if (!silentMode) {
      await broadcastToAllGuilds('🟢 En ligne !', 'Le bot est de retour et prêt à recevoir du contenu !', 0x2ecc71);
    }

    return reply.send({ silentMode });
  });

  fastify.get('/api/presence-events', (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (!isValidSession(token)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    reply.hijack();

    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    raw.write(': connected\n\n');
    // Push current state immediately so dashboards opened while users are connected see data right away
    const currentPresence = presenceStore.getAll();
    if (Object.keys(currentPresence).length > 0) {
      raw.write(`event: presence\ndata: ${JSON.stringify(currentPresence)}\n\n`);
    }

    presenceSse.register(raw);

    const keepAlive = setInterval(() => {
      try {
        raw.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    req.raw.on('close', () => clearInterval(keepAlive));
  });

  fastify.get('/api/presence/:guildId', async (req, reply) => {
    const { guildId } = req.params as { guildId: string };
    const { token } = req.query as { token?: string };

    const sessionToken = getSessionToken(req.headers.cookie);
    const hasDashboardSession = isValidSession(sessionToken);

    if (!hasDashboardSession) {
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });
      const session = await prisma.clientSession.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!session || session.guildId !== guildId) return reply.status(401).send({ error: 'Unauthorized' });
    }

    return reply.send(presenceStore.get(guildId));
  });

  fastify.post('/auth/logout', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    const csrfToken = req.headers['x-csrf-token'] as string | undefined;
    if (token && !validateCsrfToken(token, csrfToken)) return reply.status(403).send({ error: 'Invalid CSRF token' });
    if (token) deleteSession(token);
    reply.header('Set-Cookie', `session=; HttpOnly${secureFlag}; Path=/; SameSite=Lax; Max-Age=0`);
    return reply.status(204).send();
  });
}

export const DashboardRoutes = () => dashboardPlugin;
