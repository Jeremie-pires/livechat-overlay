import fetch from 'node-fetch';
import { createSession, getSessionToken, isValidSession } from '../../services/session';

const DISCORD_API = 'https://discord.com/api/v10';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LiveChat CCB — Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; }
    header { background: #1a1d2e; border-bottom: 1px solid #2d3748; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 1.2rem; font-weight: 700; color: #7289da; }
    .logout { color: #fc8181; text-decoration: none; font-size: 0.85rem; }
    .logout:hover { text-decoration: underline; }
    main { padding: 2rem; max-width: 860px; margin: 0 auto; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: #1a1d2e; border: 1px solid #2d3748; border-radius: 10px; padding: 1.25rem; }
    .card-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #718096; margin-bottom: 0.4rem; }
    .card-value { font-size: 2rem; font-weight: 700; color: #7289da; }
    .section { background: #1a1d2e; border: 1px solid #2d3748; border-radius: 10px; padding: 1.25rem; }
    .section-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #718096; margin-bottom: 1.25rem; }
    .type-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem; }
    .type-row:last-child { margin-bottom: 0; }
    .type-label { width: 55px; font-size: 0.85rem; color: #a0aec0; }
    .bar-wrap { flex: 1; height: 7px; background: #2d3748; border-radius: 4px; overflow: hidden; }
    .bar { height: 100%; border-radius: 4px; width: 0%; transition: width 0.6s ease; }
    .type-count { width: 45px; text-align: right; font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
    .bar-image { background: #3182ce; }
    .bar-video { background: #e53e3e; }
    .bar-audio { background: #38a169; }
    .bar-link  { background: #d69e2e; }
    .bar-text  { background: #805ad5; }
    .footer { font-size: 0.72rem; color: #4a5568; margin-top: 1rem; text-align: right; }
  </style>
</head>
<body>
  <header>
    <h1>LiveChat CCB</h1>
    <a class="logout" href="/auth/logout">Déconnexion</a>
  </header>
  <main>
    <div class="cards">
      <div class="card">
        <div class="card-label">Serveurs</div>
        <div class="card-value" id="servers">—</div>
      </div>
      <div class="card">
        <div class="card-label">Médias envoyés</div>
        <div class="card-value" id="totalSent">—</div>
      </div>
      <div class="card">
        <div class="card-label">Queue en attente</div>
        <div class="card-value" id="queuePending">—</div>
      </div>
      <div class="card">
        <div class="card-label">Uptime</div>
        <div class="card-value" id="uptime">—</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Répartition par type</div>
      <div class="type-row">
        <span class="type-label">Image</span>
        <div class="bar-wrap"><div class="bar bar-image" id="bar-image"></div></div>
        <span class="type-count" id="count-image">0</span>
      </div>
      <div class="type-row">
        <span class="type-label">Vidéo</span>
        <div class="bar-wrap"><div class="bar bar-video" id="bar-video"></div></div>
        <span class="type-count" id="count-video">0</span>
      </div>
      <div class="type-row">
        <span class="type-label">Audio</span>
        <div class="bar-wrap"><div class="bar bar-audio" id="bar-audio"></div></div>
        <span class="type-count" id="count-audio">0</span>
      </div>
      <div class="type-row">
        <span class="type-label">Lien</span>
        <div class="bar-wrap"><div class="bar bar-link" id="bar-link"></div></div>
        <span class="type-count" id="count-link">0</span>
      </div>
      <div class="type-row">
        <span class="type-label">Texte</span>
        <div class="bar-wrap"><div class="bar bar-text" id="bar-text"></div></div>
        <span class="type-count" id="count-text">0</span>
      </div>
    </div>
    <p class="footer" id="lastRefresh"></p>
  </main>
  <script>
    const fmt = (n) => Number(n).toLocaleString('fr-FR');
    const fmtUptime = (s) => {
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
      return d > 0 ? d + 'j ' + h + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    };
    async function refresh() {
      try {
        const res = await fetch('/api/stats');
        if (res.status === 401) { location.href = '/dashboard'; return; }
        const d = await res.json();
        document.getElementById('servers').textContent = fmt(d.servers);
        document.getElementById('totalSent').textContent = fmt(d.totalSent);
        document.getElementById('queuePending').textContent = fmt(d.queuePending);
        document.getElementById('uptime').textContent = fmtUptime(d.uptime);
        const total = d.totalSent || 1;
        for (const t of ['image', 'video', 'audio', 'link', 'text']) {
          const count = d.byType[t] ?? 0;
          document.getElementById('count-' + t).textContent = fmt(count);
          document.getElementById('bar-' + t).style.width = Math.round((count / total) * 100) + '%';
        }
        document.getElementById('lastRefresh').textContent = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
      } catch (e) { console.error(e); }
    }
    refresh();
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;

export const DashboardRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    if (!env.DISCORD_CLIENT_SECRET) {
      logger.warn('[DASHBOARD] DISCORD_CLIENT_SECRET not set — dashboard disabled');
      return;
    }

    const redirectUri = `${env.API_URL}/auth/callback`;
    const oauthUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${env.DISCORD_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=identify`;

    fastify.get('/dashboard', async (req, reply) => {
      const token = getSessionToken(req.headers.cookie);
      if (!isValidSession(token)) {
        return reply.redirect(302, oauthUrl);
      }
      return reply.type('text/html').send(DASHBOARD_HTML);
    });

    fastify.get('/auth/callback', async (req, reply) => {
      const { code } = req.query as { code?: string };
      if (!code) return reply.status(400).send('Missing code');

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
      reply.header(
        'Set-Cookie',
        `session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
      );
      return reply.redirect(302, '/dashboard');
    });

    fastify.get('/auth/logout', async (_req, reply) => {
      reply.header('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
      return reply.redirect(302, '/dashboard');
    });
  };
