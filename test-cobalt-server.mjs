import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = join(__dirname, 'cobalt-cookies', 'cookies.txt');

/**
 * Parse a Netscape cookies.txt and return a Cookie header string for `targetDomain`.
 * A cookie domain of `.tiktok.com` matches any subdomain (e.g. v19-webapp.tiktok.com).
 */
async function parseCookiesForDomain(cookiesFile, targetDomain) {
  let content;
  try {
    content = await readFile(cookiesFile, 'utf-8');
  } catch {
    return '';
  }
  const pairs = [];
  for (const line of content.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [cookieDomain, , , , , name, ...rest] = parts;
    const value = rest.join('\t').trimEnd();
    const bare = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
    if (targetDomain === cookieDomain || targetDomain === bare || targetDomain.endsWith('.' + bare)) {
      pairs.push(`${name}=${value}`);
    }
  }
  return pairs.join('; ');
}
const COBALT_API_URL = 'http://localhost:9000';

const TIKTOK_URL = 'https://www.tiktok.com/@ryolaitrouge/video/7692892096264441120?is_from_webapp=1&sender_device=pc';
const TWITTER_URL = 'https://x.com/CHISIAMOV/status/2106828931097903277/video/1';

// Use -J to get full info including http_headers required by the CDN
function extractWithYtdlp(url) {
  return new Promise((resolve) => {
    const args = [
      '--no-playlist',
      '--format', 'best[ext=mp4]/best',
      '-J',
      '--cookies', COOKIES_FILE,
      url,
    ];

    let stdout = '';
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };

    let proc;
    try {
      proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      settle(null);
      return;
    }

    const timer = setTimeout(() => { proc.kill('SIGKILL'); settle(null); }, 30000);

    proc.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf-8'); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) { settle(null); return; }
      try {
        const info = JSON.parse(stdout);
        const videoUrl = info.url;
        const headers = info.http_headers ?? {};
        settle(videoUrl?.startsWith('http') ? { url: videoUrl, headers } : null);
      } catch {
        settle(null);
      }
    });

    proc.on('error', () => { clearTimeout(timer); settle(null); });
  });
}

async function resolveCobalt(url) {
  try {
    const res = await fetch(COBALT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if ((data.status === 'tunnel' || data.status === 'stream' || data.status === 'redirect') && data.url) {
      return { url: data.url, status: data.status };
    }
    return null;
  } catch {
    return null;
  }
}

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>LiveChatCCB — test video brute</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { background: #111; color: #eee; font-family: sans-serif; margin: 0; padding: 20px; }
    h1 { font-size: 0.9rem; color: #64748b; margin-bottom: 12px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    button { padding: 8px 14px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0;
             border-radius: 6px; cursor: pointer; font-size: 13px; }
    button:hover { background: #334155; }
    button:disabled { opacity: 0.4; cursor: default; }
    #status { background: #0f172a; border: 1px solid #334155; border-radius: 6px;
              padding: 8px 12px; margin-bottom: 12px; font-family: monospace;
              font-size: 11px; color: #94a3b8; word-break: break-all; min-height: 18px; }
    :root { --w: 720px; }
    #stage {
      width: var(--w);
      height: calc(var(--w) * 9 / 16);
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      position: relative;
    }
    #stage video { width: 100%; height: 100%; object-fit: contain; background: #000; }
    #stage .placeholder { color: #475569; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px;
             font-weight: 700; text-transform: uppercase; margin-left: 6px; }
    .badge-yt { background: #422006; color: #fb923c; }
    .badge-cobalt { background: #0c2d4a; color: #38bdf8; }
  </style>
</head>
<body>
  <h1>LiveChatCCB — test URL vidéo brute → lecture native</h1>
  <div class="controls">
    <button id="btn-tt"  onclick="test('tiktok')">▶ TikTok <span class="badge badge-yt">yt-dlp</span></button>
    <button id="btn-tw"  onclick="test('twitter')">▶ Twitter/X <span class="badge badge-cobalt">cobalt</span></button>
    <button onclick="clear_()">✕ Clear</button>
  </div>
  <div id="status">—</div>
  <div id="stage"><span class="placeholder">Aucune vidéo</span></div>

  <script>
    var BTNS = ['btn-tt', 'btn-tw'];
    function setStatus(msg, color) {
      var el = document.getElementById('status');
      el.textContent = msg;
      el.style.color = color || '#94a3b8';
    }
    function setLoading(on) {
      BTNS.forEach(function(id) { document.getElementById(id).disabled = on; });
    }
    async function test(type) {
      setLoading(true);
      setStatus(type === 'tiktok' ? 'Extraction yt-dlp (-J)…' : 'Résolution Cobalt…');
      document.getElementById('stage').innerHTML = '<span class="placeholder">Chargement…</span>';
      try {
        var res  = await fetch('/api/resolve?type=' + type);
        var data = await res.json();
        if (data.error) {
          setStatus('❌ ' + data.error, '#f87171');
          document.getElementById('stage').innerHTML = '<span class="placeholder">Erreur</span>';
        } else {
          var extractor = data.extractor === 'ytdlp' ? 'yt-dlp' : ('Cobalt [' + data.cobaltStatus + ']');
          setStatus('✅ ' + extractor + ' → proxy → lecture native (chargement…)', '#4ade80');
          playVideo(data.proxyUrl);
        }
      } catch(e) {
        setStatus('❌ ' + e.message, '#f87171');
      } finally {
        setLoading(false);
      }
    }
    function playVideo(url) {
      var stage = document.getElementById('stage');
      stage.innerHTML = '';
      var vid = document.createElement('video');
      vid.controls = true;
      vid.autoplay  = true;
      vid.muted     = true;
      vid.loop      = true;
      vid.src       = url;
      vid.onloadedmetadata = function() {
        setStatus('✅ Vidéo chargée — durée: ' + Math.round(vid.duration) + 's — readyState: ' + vid.readyState, '#4ade80');
      };
      vid.onerror = function() {
        setStatus('⚠️ Video error (readyState=' + vid.readyState + ', networkState=' + vid.networkState + ')', '#fb923c');
      };
      stage.appendChild(vid);
    }
    function clear_() {
      document.getElementById('stage').innerHTML = '<span class="placeholder">Aucune vidéo</span>';
      document.getElementById('status').textContent = '—';
    }
  </script>
</body>
</html>`;

// Cache: { url, headers, type }
const urlCache = new Map();

function cacheEntry(entry) {
  const token = Math.random().toString(36).slice(2);
  urlCache.set(token, { ...entry, exp: Date.now() + 5 * 60_000 });
  return token;
}

function getCached(token) {
  const entry = urlCache.get(token);
  if (!entry || Date.now() > entry.exp) { urlCache.delete(token); return null; }
  return entry;
}

const server = createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost');

  if (reqUrl.pathname === '/api/resolve') {
    const type = reqUrl.searchParams.get('type');
    const target = type === 'twitter' ? TWITTER_URL : TIKTOK_URL;

    try {
      if (type === 'tiktok') {
        const result = await extractWithYtdlp(target);
        if (!result) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'yt-dlp returned no URL' }));
          return;
        }
        console.log('[yt-dlp] url:', result.url.slice(0, 80));
        console.log('[yt-dlp] headers from yt-dlp:', JSON.stringify(result.headers));

        // Inject TikTok CDN cookies (tt_chain_token, sessionid, etc.)
        const cdnDomain = new URL(result.url).hostname;
        const cookieHeader = await parseCookiesForDomain(COOKIES_FILE, cdnDomain);
        if (cookieHeader) {
          result.headers['Cookie'] = cookieHeader;
          console.log('[yt-dlp] injected Cookie header for', cdnDomain, '—', cookieHeader.slice(0, 80) + '…');
        } else {
          console.warn('[yt-dlp] no cookies found for domain:', cdnDomain);
        }

        const token = cacheEntry({ url: result.url, headers: result.headers, type: 'tiktok' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ extractor: 'ytdlp', proxyUrl: `/api/stream?t=${token}` }));
      } else {
        const cobalt = await resolveCobalt(target);
        if (!cobalt) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Cobalt indisponible' }));
          return;
        }
        const token = cacheEntry({ url: cobalt.url, headers: {}, type: 'twitter' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ extractor: 'cobalt', cobaltStatus: cobalt.status, proxyUrl: `/api/stream?t=${token}` }));
      }
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (reqUrl.pathname === '/api/stream') {
    const token = reqUrl.searchParams.get('t');
    const entry = token ? getCached(token) : null;
    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('expired or unknown token');
      return;
    }

    const rangeHeader = req.headers['range'];

    // Use headers provided by yt-dlp (include cookies, UA, Referer set by extractor)
    const upstreamHeaders = {
      ...entry.headers,
      ...(rangeHeader ? { Range: rangeHeader } : { Range: 'bytes=0-' }),
    };

    let upstream;
    try {
      upstream = await fetch(entry.url, { headers: upstreamHeaders });
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('upstream fetch failed: ' + String(err));
      return;
    }

    console.log(`[stream] ${entry.type} CDN status: ${upstream.status}`);

    if (upstream.status === 403 || upstream.status === 401) {
      const body = await upstream.text().catch(() => '');
      console.log('[stream] CDN rejected:', body.slice(0, 200));
      res.writeHead(upstream.status, { 'Content-Type': 'text/plain' });
      res.end(`CDN ${upstream.status}`);
      return;
    }

    const ct = upstream.headers.get('content-type') ?? 'video/mp4';
    const cl = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');
    const outHeaders = { 'Content-Type': ct, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
    if (cl) outHeaders['Content-Length'] = cl;
    if (cr) outHeaders['Content-Range'] = cr;
    res.writeHead(upstream.status === 206 ? 206 : 200, outHeaders);

    const readable = Readable.fromWeb(upstream.body);
    readable.on('error', (err) => {
      console.error('[stream] pipe error:', err.message);
      if (!res.writableEnded) res.end();
    });
    res.on('close', () => readable.destroy());
    readable.pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(4502, '127.0.0.1', () => {
  console.log('Test server: http://127.0.0.1:4502');
  console.log('  TikTok → yt-dlp -J | cookies:', COOKIES_FILE);
  console.log('  Twitter → Cobalt   | url:', COBALT_API_URL);
});
