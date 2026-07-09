import fetch from 'node-fetch';
import { createSession, getSessionToken, isValidSession } from '../../services/session';

const DISCORD_API = 'https://discord.com/api/v10';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LiveChat CCB</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0b0d12;
      --sidebar: #0e1017;
      --card: #13161f;
      --border: #1c2032;
      --accent: #5865f2;
      --accent-dim: rgba(88,101,242,0.12);
      --text: #e4e6f0;
      --muted: #6b7480;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
    }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    .app { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }

    /* Sidebar */
    .sidebar { background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; width: 220px; }
    .sidebar-logo { padding: 1.4rem 1.25rem 1.1rem; display: flex; align-items: center; gap: 0.7rem; border-bottom: 1px solid var(--border); }
    .logo-icon { width: 34px; height: 34px; background: var(--accent); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo-icon svg { width: 16px; height: 16px; stroke: white; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .logo-text { font-size: 0.88rem; font-weight: 700; line-height: 1.2; }
    .logo-sub { font-size: 0.63rem; color: var(--muted); }
    nav { padding: 0.75rem; flex: 1; overflow-y: auto; }
    .nav-section { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); padding: 0.7rem 0.5rem 0.3rem; margin-top: 0.25rem; }
    .nav-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.75rem; border-radius: 8px; font-size: 0.855rem; color: var(--muted); cursor: pointer; text-decoration: none; transition: background 0.12s, color 0.12s; margin-bottom: 2px; user-select: none; }
    .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
    .nav-item.active { background: var(--accent-dim); color: var(--accent); font-weight: 600; }
    .nav-item svg { width: 15px; height: 15px; flex-shrink: 0; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid var(--border); }
    .logout-btn { display: block; text-align: center; font-size: 0.78rem; color: var(--muted); text-decoration: none; padding: 0.4rem; border-radius: 6px; transition: color 0.12s; }
    .logout-btn:hover { color: var(--red); }

    /* Content */
    .content { margin-left: 220px; padding: 2rem 2.25rem; }
    .page { display: none; }
    .page.active { display: block; }
    .page-header { margin-bottom: 1.75rem; }
    .page-title { font-size: 1.35rem; font-weight: 700; }
    .page-subtitle { font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; }

    /* Cards */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; position: relative; overflow: hidden; transition: border-color 0.15s, transform 0.1s; }
    .card.clickable { cursor: pointer; }
    .card.clickable:hover { border-color: var(--accent); transform: translateY(-1px); }
    .card-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.85rem; }
    .card-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .card-icon.blue { background: rgba(88,101,242,0.15); color: var(--accent); }
    .card-icon.green { background: rgba(16,185,129,0.15); color: var(--green); }
    .card-icon.yellow { background: rgba(245,158,11,0.15); color: var(--yellow); }
    .card-icon.red { background: rgba(239,68,68,0.15); color: var(--red); }
    .card-icon.purple { background: rgba(168,85,247,0.15); color: #a855f7; }
    .card-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 0.25rem; }
    .card-value { font-size: 1.85rem; font-weight: 700; line-height: 1; }
    .card-hint { font-size: 0.65rem; color: var(--accent); margin-top: 0.4rem; }

    /* Section */
    .section { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
    .section-title { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 1.25rem; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

    /* Type bars */
    .type-row { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.8rem; }
    .type-row:last-child { margin-bottom: 0; }
    .type-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .type-label { width: 50px; font-size: 0.8rem; color: var(--muted); }
    .bar-wrap { flex: 1; height: 5px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .bar { height: 100%; border-radius: 99px; width: 0%; transition: width 0.55s cubic-bezier(0.4,0,0.2,1); }
    .type-pct { width: 34px; text-align: right; font-size: 0.72rem; color: var(--muted); }
    .type-count { width: 46px; text-align: right; font-size: 0.8rem; font-weight: 600; }
    .bar-image, .dot-image { background: #3b82f6; }
    .bar-video, .dot-video { background: var(--red); }
    .bar-audio, .dot-audio { background: var(--green); }
    .bar-link,  .dot-link  { background: var(--yellow); }
    .bar-text,  .dot-text  { background: #a855f7; }

    /* Sparkline */
    .sparkline-svg { width: 100%; height: 72px; display: block; }
    .spark-line { fill: none; stroke: var(--accent); stroke-width: 1.5; }
    .spark-area { fill: url(#spark-grad); }
    .spark-meta { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--muted); margin-top: 0.5rem; }

    /* System bars */
    .sys-row { margin-bottom: 0.9rem; }
    .sys-row:last-child { margin-bottom: 0; }
    .sys-row-head { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
    .sys-label { font-size: 0.8rem; color: var(--muted); }
    .sys-value { font-size: 0.8rem; font-weight: 600; }
    .sys-bar-wrap { height: 5px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .sys-bar { height: 100%; border-radius: 99px; transition: width 0.5s ease, background 0.3s; }
    .sys-bar.accent { background: var(--accent); }
    .sys-bar.green { background: var(--green); }
    .sys-bar.yellow { background: var(--yellow); }
    .sys-bar.red { background: var(--red); }

    /* Server grid */
    .server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.7rem; }
    .server-card { background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 10px; padding: 0.8rem 1rem; display: flex; align-items: center; gap: 0.8rem; transition: border-color 0.15s; }
    .server-card:hover { border-color: rgba(88,101,242,0.35); }
    .server-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .server-avatar-ph { width: 42px; height: 42px; border-radius: 50%; background: var(--accent-dim); border: 1px solid rgba(88,101,242,0.25); display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
    .server-name { font-size: 0.875rem; font-weight: 600; }
    .server-members { font-size: 0.7rem; color: var(--muted); margin-top: 0.1rem; }

    /* Badge */
    .badge { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; padding: 0.18rem 0.5rem; border-radius: 99px; font-weight: 500; }
    .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
    .badge.green { background: rgba(16,185,129,0.12); color: var(--green); }

    .refresh-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; font-size: 0.7rem; color: var(--muted); }

    /* stat sub-cards inside section */
    .stat-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .stat-mini-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.75rem; }
    .stat-mini-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.25rem; }
    .stat-mini-value { font-size: 1.2rem; font-weight: 700; }
  </style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.28 6.28l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <div>
        <div class="logo-text">LiveChat CCB</div>
        <div class="logo-sub">Dashboard</div>
      </div>
    </div>
    <nav>
      <div class="nav-section">Navigation</div>
      <a class="nav-item active" onclick="navigate('home')" data-page="home">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Accueil
      </a>
      <a class="nav-item" onclick="navigate('servers')" data-page="servers">
        <svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        Serveurs
      </a>
      <a class="nav-item" onclick="navigate('messages')" data-page="messages">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Messages
      </a>
      <a class="nav-item" onclick="navigate('network')" data-page="network">
        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Réseau & Système
      </a>
    </nav>
    <div class="sidebar-footer">
      <a href="/auth/logout" class="logout-btn">← Déconnexion</a>
    </div>
  </aside>

  <main class="content">

    <!-- ACCUEIL -->
    <div class="page active" id="page-home">
      <div class="page-header">
        <div class="page-title">Vue d'ensemble</div>
        <div class="page-subtitle">Statistiques globales du bot en temps réel</div>
      </div>
      <div class="cards-grid">
        <div class="card clickable" onclick="navigate('servers')">
          <div class="card-icon blue"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
          <div class="card-label">Serveurs</div>
          <div class="card-value" id="h-servers">—</div>
          <div class="card-hint">Voir la liste →</div>
        </div>
        <div class="card clickable" onclick="navigate('messages')">
          <div class="card-icon green"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="card-label">Médias envoyés</div>
          <div class="card-value" id="h-totalSent">—</div>
          <div class="card-hint">Voir les stats →</div>
        </div>
        <div class="card">
          <div class="card-icon yellow"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="card-label">Uptime</div>
          <div class="card-value" id="h-uptime">—</div>
        </div>
        <div class="card clickable" onclick="navigate('messages')">
          <div class="card-icon purple"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
          <div class="card-label">Latence moy.</div>
          <div class="card-value" id="h-latency">—</div>
          <div class="card-hint">Voir le graphe →</div>
        </div>
        <div class="card clickable" onclick="navigate('network')">
          <div class="card-icon red"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <div class="card-label">CPU système</div>
          <div class="card-value" id="h-cpu">—</div>
          <div class="card-hint">Voir le détail →</div>
        </div>
        <div class="card clickable" onclick="navigate('network')">
          <div class="card-icon blue"><svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg></div>
          <div class="card-label">RAM (RSS)</div>
          <div class="card-value" id="h-mem">—</div>
          <div class="card-hint">Voir le détail →</div>
        </div>
      </div>
      <div class="refresh-row">
        <span class="badge green">En ligne</span>
        <span id="h-refresh">—</span>
      </div>
    </div>

    <!-- SERVEURS -->
    <div class="page" id="page-servers">
      <div class="page-header">
        <div class="page-title">Serveurs</div>
        <div class="page-subtitle" id="s-subtitle">Chargement...</div>
      </div>
      <div class="server-grid" id="server-grid"></div>
    </div>

    <!-- MESSAGES -->
    <div class="page" id="page-messages">
      <div class="page-header">
        <div class="page-title">Messages & Médias</div>
        <div class="page-subtitle">Analyse des contenus envoyés via le bot</div>
      </div>
      <div class="cards-grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))">
        <div class="card">
          <div class="card-label">Total envoyés</div>
          <div class="card-value" id="m-total">—</div>
        </div>
        <div class="card">
          <div class="card-label">Latence moy.</div>
          <div class="card-value" id="m-latency">—</div>
        </div>
        <div class="card">
          <div class="card-label">Queue en attente</div>
          <div class="card-value" id="m-queue">—</div>
        </div>
      </div>
      <div class="two-col">
        <div class="section">
          <div class="section-title">Répartition par type</div>
          <div class="type-row"><span class="type-dot dot-image"></span><span class="type-label">Image</span><div class="bar-wrap"><div class="bar bar-image" id="bar-image"></div></div><span class="type-pct" id="pct-image">0%</span><span class="type-count" id="count-image">0</span></div>
          <div class="type-row"><span class="type-dot dot-video"></span><span class="type-label">Vidéo</span><div class="bar-wrap"><div class="bar bar-video" id="bar-video"></div></div><span class="type-pct" id="pct-video">0%</span><span class="type-count" id="count-video">0</span></div>
          <div class="type-row"><span class="type-dot dot-audio"></span><span class="type-label">Audio</span><div class="bar-wrap"><div class="bar bar-audio" id="bar-audio"></div></div><span class="type-pct" id="pct-audio">0%</span><span class="type-count" id="count-audio">0</span></div>
          <div class="type-row"><span class="type-dot dot-link"></span><span class="type-label">Lien</span><div class="bar-wrap"><div class="bar bar-link" id="bar-link"></div></div><span class="type-pct" id="pct-link">0%</span><span class="type-count" id="count-link">0</span></div>
          <div class="type-row"><span class="type-dot dot-text"></span><span class="type-label">Texte</span><div class="bar-wrap"><div class="bar bar-text" id="bar-text"></div></div><span class="type-pct" id="pct-text">0%</span><span class="type-count" id="count-text">0</span></div>
        </div>
        <div class="section">
          <div class="section-title">Latence — 50 derniers envois</div>
          <svg class="sparkline-svg" id="sparkline" viewBox="0 0 400 72" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#5865f2" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#5865f2" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path class="spark-area" id="spark-area" d=""/>
            <path class="spark-line" id="spark-line" d=""/>
          </svg>
          <div class="spark-meta">
            <span id="spark-min">min —</span>
            <span id="spark-avg">moy —</span>
            <span id="spark-max">max —</span>
          </div>
        </div>
      </div>
    </div>

    <!-- RESEAU -->
    <div class="page" id="page-network">
      <div class="page-header">
        <div class="page-title">Réseau & Système</div>
        <div class="page-subtitle">Consommation des ressources du processus bot</div>
      </div>
      <div class="two-col">
        <div class="section">
          <div class="section-title">CPU & Charge</div>
          <div class="sys-row">
            <div class="sys-row-head"><span class="sys-label">CPU (système global)</span><span class="sys-value" id="n-cpu">—</span></div>
            <div class="sys-bar-wrap"><div class="sys-bar accent" id="n-cpu-bar" style="width:0%"></div></div>
          </div>
          <div style="margin-top:1.1rem">
            <div class="sys-row">
              <div class="sys-row-head"><span class="sys-label">Load avg 1 min</span><span class="sys-value" id="n-load1">—</span></div>
            </div>
            <div class="sys-row">
              <div class="sys-row-head"><span class="sys-label">Load avg 5 min</span><span class="sys-value" id="n-load5">—</span></div>
            </div>
            <div class="sys-row">
              <div class="sys-row-head"><span class="sys-label">Load avg 15 min</span><span class="sys-value" id="n-load15">—</span></div>
            </div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Mémoire</div>
          <div class="sys-row">
            <div class="sys-row-head"><span class="sys-label">RAM système (utilisée)</span><span class="sys-value" id="n-sysram">—</span></div>
            <div class="sys-bar-wrap"><div class="sys-bar green" id="n-sysram-bar" style="width:0%"></div></div>
          </div>
          <div class="sys-row" style="margin-top:1rem">
            <div class="sys-row-head"><span class="sys-label">Heap Node.js</span><span class="sys-value" id="n-heap">—</span></div>
            <div class="sys-bar-wrap"><div class="sys-bar yellow" id="n-heap-bar" style="width:0%"></div></div>
          </div>
          <div class="sys-row" style="margin-top:1rem">
            <div class="sys-row-head"><span class="sys-label">RSS processus</span><span class="sys-value" id="n-rss">—</span></div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">WebSocket — données envoyées</div>
        <div class="stat-mini">
          <div class="stat-mini-item">
            <div class="stat-mini-label">Total payload</div>
            <div class="stat-mini-value" id="n-payload">—</div>
          </div>
          <div class="stat-mini-item">
            <div class="stat-mini-label">Messages traités</div>
            <div class="stat-mini-value" id="n-total">—</div>
          </div>
          <div class="stat-mini-item">
            <div class="stat-mini-label">Taille moy. / msg</div>
            <div class="stat-mini-value" id="n-avg-payload">—</div>
          </div>
        </div>
      </div>
      <div class="refresh-row"><span></span><span id="n-refresh">—</span></div>
    </div>

  </main>
</div>
<script>
  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelector('[data-page="' + page + '"]').classList.add('active');
  }

  const fmt = n => Number(n).toLocaleString('fr-FR');
  const fmtBytes = b => b >= 1073741824 ? (b/1073741824).toFixed(2)+' GB' : b >= 1048576 ? (b/1048576).toFixed(1)+' MB' : b >= 1024 ? (b/1024).toFixed(1)+' KB' : b+' B';
  const fmtMs = ms => ms >= 1000 ? (ms/1000).toFixed(2)+'s' : ms+'ms';
  const fmtUptime = s => { const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); return d>0?d+'j '+h+'h':h>0?h+'h '+m+'m':m+'m '+sec+'s'; };

  function renderSparkline(samples) {
    if (!samples || samples.length < 2) return;
    const W=400, H=72, p=5;
    const mn=Math.min(...samples), mx=Math.max(...samples), rng=mx-mn||1;
    const avg=Math.round(samples.reduce((a,b)=>a+b,0)/samples.length);
    const pts=samples.map((v,i)=>[(p+(i/(samples.length-1))*(W-p*2)).toFixed(1),(H-p-((v-mn)/rng)*(H-p*2)).toFixed(1)]);
    const line=pts.map((pt,i)=>(i===0?'M':'L')+pt[0]+','+pt[1]).join(' ');
    document.getElementById('spark-line').setAttribute('d', line);
    document.getElementById('spark-area').setAttribute('d', line+' L'+pts[pts.length-1][0]+','+H+' L'+p+','+H+' Z');
    document.getElementById('spark-min').textContent = 'min '+fmtMs(mn);
    document.getElementById('spark-avg').textContent = 'moy '+fmtMs(avg);
    document.getElementById('spark-max').textContent = 'max '+fmtMs(mx);
  }

  function renderServers(guilds) {
    const sorted=(guilds||[]).sort((a,b)=>b.memberCount-a.memberCount);
    document.getElementById('s-subtitle').textContent = sorted.length+' serveur'+(sorted.length>1?'s':'')+' connecté'+(sorted.length>1?'s':'');
    document.getElementById('server-grid').innerHTML = sorted.map(g => {
      const av = g.icon ? '<img class="server-avatar" src="'+g.icon+'" alt="">' : '<div class="server-avatar-ph">'+g.name.charAt(0).toUpperCase()+'</div>';
      return '<div class="server-card">'+av+'<div><div class="server-name">'+g.name+'</div><div class="server-members">'+fmt(g.memberCount)+' membres</div></div></div>';
    }).join('');
  }

  async function refresh() {
    try {
      const res = await fetch('/api/stats');
      if (res.status === 401) { location.href = '/dashboard'; return; }
      const d = await res.json();
      const now = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
      const sys = d.system || {};

      // Accueil
      document.getElementById('h-servers').textContent = fmt(d.servers);
      document.getElementById('h-totalSent').textContent = fmt(d.totalSent);
      document.getElementById('h-uptime').textContent = fmtUptime(d.uptime);
      document.getElementById('h-latency').textContent = d.latency?.avgMs > 0 ? fmtMs(d.latency.avgMs) : '—';
      document.getElementById('h-cpu').textContent = (sys.cpuPercent ?? 0) + '%';
      document.getElementById('h-mem').textContent = fmtBytes((sys.memRssMB ?? 0) * 1048576);
      document.getElementById('h-refresh').textContent = now;

      // Messages
      document.getElementById('m-total').textContent = fmt(d.totalSent);
      document.getElementById('m-latency').textContent = d.latency?.avgMs > 0 ? fmtMs(d.latency.avgMs) : '—';
      document.getElementById('m-queue').textContent = fmt(d.queuePending);
      const total = d.totalSent || 1;
      for (const t of ['image','video','audio','link','text']) {
        const count = d.byType[t] ?? 0;
        const pct = Math.round((count/total)*100);
        document.getElementById('count-'+t).textContent = fmt(count);
        document.getElementById('pct-'+t).textContent = pct+'%';
        document.getElementById('bar-'+t).style.width = pct+'%';
      }
      renderSparkline(d.latency?.samples);

      // Serveurs
      renderServers(d.guilds);

      // Réseau
      const cpuPct = sys.cpuPercent ?? 0;
      document.getElementById('n-cpu').textContent = cpuPct+'%';
      const cpuBar = document.getElementById('n-cpu-bar');
      cpuBar.style.width = Math.min(100,cpuPct)+'%';
      cpuBar.className = 'sys-bar '+(cpuPct>80?'red':cpuPct>50?'yellow':'accent');

      const usedMB = (sys.memTotalMB??0)-(sys.memFreeMB??0);
      const sysPct = sys.memTotalMB ? Math.round(usedMB/sys.memTotalMB*100) : 0;
      document.getElementById('n-sysram').textContent = fmtBytes(usedMB*1048576)+' / '+fmtBytes((sys.memTotalMB??0)*1048576);
      const sysBar = document.getElementById('n-sysram-bar');
      sysBar.style.width = sysPct+'%';
      sysBar.className = 'sys-bar '+(sysPct>85?'red':sysPct>65?'yellow':'green');

      const heapPct = sys.memHeapTotalMB ? Math.round(sys.memHeapUsedMB/sys.memHeapTotalMB*100) : 0;
      document.getElementById('n-heap').textContent = fmtBytes((sys.memHeapUsedMB??0)*1048576)+' / '+fmtBytes((sys.memHeapTotalMB??0)*1048576);
      document.getElementById('n-heap-bar').style.width = heapPct+'%';
      document.getElementById('n-rss').textContent = fmtBytes((sys.memRssMB??0)*1048576);

      document.getElementById('n-load1').textContent = (sys.loadAvg?.[0]??0).toFixed(2);
      document.getElementById('n-load5').textContent = (sys.loadAvg?.[1]??0).toFixed(2);
      document.getElementById('n-load15').textContent = (sys.loadAvg?.[2]??0).toFixed(2);

      const bytes = d.latency?.totalPayloadBytes ?? 0;
      document.getElementById('n-payload').textContent = fmtBytes(bytes);
      document.getElementById('n-total').textContent = fmt(d.totalSent);
      document.getElementById('n-avg-payload').textContent = d.totalSent > 0 ? fmtBytes(Math.round(bytes/d.totalSent)) : '—';
      document.getElementById('n-refresh').textContent = now;

    } catch(e) { console.error(e); }
  }

  refresh();
  setInterval(refresh, 30000);
</script>
</body>
</html>`;

export const DashboardRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
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
      if (!env.DISCORD_CLIENT_SECRET) {
        return reply.status(503).send('DISCORD_CLIENT_SECRET not configured');
      }
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
