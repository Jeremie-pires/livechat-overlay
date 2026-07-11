import { createHash } from 'crypto';
import fetch from 'node-fetch';
import { createSession, deleteSession, getSessionToken, isValidSession } from '../../services/session';
import { broadcastToAllGuilds } from '../../services/broadcast';
import { presenceStore } from '../../services/presenceStore';
import { presenceSse } from '../../services/presenceSse';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

const DISCORD_API = 'https://discord.com/api/v10';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LiveChat CCB — Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #030303;
      --border: rgba(255,255,255,0.08);
      --border-strong: rgba(255,255,255,0.14);
      --glass: rgba(8,8,8,0.65);
      --glass-hover: rgba(12,12,12,0.80);
      --overlay: rgba(255,255,255,0.03);
      --text: #ededed;
      --muted: rgba(255,255,255,0.50);
      --accent: #5865f2;
      --accent-rgb: 88,101,242;
      --green: #10b981;
      --red: #ef4444;
      --yellow: #f59e0b;
      --purple: #a855f7;
    }
    body { font-family: 'Geist', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
    .app { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }

    /* Sidebar */
    .sidebar { background: rgba(4,4,4,0.90); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; width: 220px; z-index: 10; }
    .sidebar-logo { padding: 1.4rem 1.25rem 1.1rem; display: flex; align-items: center; gap: 0.7rem; border-bottom: 1px solid var(--border); }
    .logo-icon { width: 34px; height: 34px; background: rgba(var(--accent-rgb),0.12); border: 1px solid rgba(var(--accent-rgb),0.22); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo-icon svg { width: 15px; height: 15px; stroke: var(--accent); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .logo-text { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .logo-sub { font-size: 0.62rem; color: var(--muted); margin-top: 1px; }
    nav { padding: 0.75rem; flex: 1; overflow-y: auto; }
    .nav-section { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.28); padding: 0.7rem 0.5rem 0.3rem; margin-top: 0.25rem; }
    .nav-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.75rem; border-radius: 10px; font-size: 0.84rem; color: var(--muted); cursor: pointer; text-decoration: none; transition: background 0.2s, color 0.2s, border-color 0.2s; margin-bottom: 2px; user-select: none; border: 1px solid transparent; }
    .nav-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.80); border-color: var(--border); }
    .nav-item.active { background: rgba(var(--accent-rgb),0.10); color: var(--accent); font-weight: 600; border-color: rgba(var(--accent-rgb),0.18); }
    .nav-item svg { width: 15px; height: 15px; flex-shrink: 0; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid var(--border); }
    .logout-btn { display: block; text-align: center; font-size: 0.78rem; color: var(--muted); text-decoration: none; padding: 0.45rem; border-radius: 8px; transition: color 0.2s, background 0.2s, border-color 0.2s; border: 1px solid transparent; }
    .logout-btn:hover { color: var(--red); border-color: rgba(239,68,68,0.18); background: rgba(239,68,68,0.06); }

    /* Content */
    .content { grid-column: 2; min-height: 100vh; position: relative; overflow: hidden; }
    .page-glow { position: absolute; top: -80px; left: 50%; transform: translateX(-50%); width: 100%; height: 320px; background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(120,119,198,0.16), transparent 70%); pointer-events: none; z-index: 0; }
    .content-inner { padding: 2rem 2.25rem; position: relative; z-index: 1; }

    .page { display: none; }
    .page.active { display: block; animation: fade-in-up 0.45s cubic-bezier(0.16,1,0.3,1) both; }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header { margin-bottom: 2rem; }
    .page-title { font-size: 1.4rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }
    .page-subtitle { font-size: 0.78rem; color: var(--muted); margin-top: 0.3rem; }

    /* Cards */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 0.875rem; margin-bottom: 1.25rem; }
    .card { background: var(--glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 16px; padding: 1.25rem; position: relative; overflow: hidden; transition: border-color 0.3s, box-shadow 0.3s, background 0.3s; }
    .card.clickable { cursor: pointer; }
    .card.clickable:hover { border-color: var(--border-strong); background: var(--glass-hover); box-shadow: 0 0 24px rgba(120,119,198,0.10); }
    .card-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; border: 1px solid; }
    .card-icon svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .card-icon.blue { background: rgba(88,101,242,0.10); border-color: rgba(88,101,242,0.20); color: var(--accent); }
    .card-icon.green { background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.20); color: var(--green); }
    .card-icon.yellow { background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.20); color: var(--yellow); }
    .card-icon.red { background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.20); color: var(--red); }
    .card-icon.purple { background: rgba(168,85,247,0.10); border-color: rgba(168,85,247,0.20); color: var(--purple); }
    .card-label { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.3rem; font-weight: 500; }
    .card-value { font-size: 1.9rem; font-weight: 700; line-height: 1; color: var(--text); letter-spacing: -0.02em; }
    .card-hint { font-size: 0.64rem; color: rgba(var(--accent-rgb),0.65); margin-top: 0.5rem; font-weight: 500; transition: color 0.2s; }
    .card.clickable:hover .card-hint { color: var(--accent); }

    /* Section */
    .section { background: var(--glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.25rem; }
    .section-title { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.10em; color: rgba(255,255,255,0.32); margin-bottom: 1.25rem; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

    /* Type bars */
    .type-row { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.9rem; }
    .type-row:last-child { margin-bottom: 0; }
    .type-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .type-label { width: 48px; font-size: 0.78rem; color: var(--muted); font-weight: 500; }
    .bar-wrap { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .bar { height: 100%; border-radius: 99px; width: 0%; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
    .type-pct { width: 34px; text-align: right; font-size: 0.7rem; color: var(--muted); }
    .type-count { width: 46px; text-align: right; font-size: 0.8rem; font-weight: 600; color: var(--text); }
    .bar-image, .dot-image { background: #3b82f6; }
    .bar-video, .dot-video { background: var(--red); }
    .bar-audio, .dot-audio { background: var(--green); }
    .bar-link, .dot-link { background: var(--yellow); }
    .bar-text, .dot-text { background: var(--purple); }

    /* Sparkline */
    .sparkline-svg { width: 100%; height: 72px; display: block; }
    .spark-line { fill: none; stroke: var(--accent); stroke-width: 1.5; }
    .spark-area { fill: url(#spark-grad); }
    .spark-meta { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--muted); margin-top: 0.6rem; font-weight: 500; }

    /* System bars */
    .sys-row { margin-bottom: 1rem; }
    .sys-row:last-child { margin-bottom: 0; }
    .sys-row-head { display: flex; justify-content: space-between; margin-bottom: 0.4rem; }
    .sys-label { font-size: 0.78rem; color: var(--muted); }
    .sys-value { font-size: 0.78rem; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
    .sys-bar-wrap { height: 4px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .sys-bar { height: 100%; border-radius: 99px; transition: width 0.5s ease, background 0.3s; }
    .sys-bar.accent { background: var(--accent); }
    .sys-bar.green { background: var(--green); }
    .sys-bar.yellow { background: var(--yellow); }
    .sys-bar.red { background: var(--red); }

    /* Server grid */
    .server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.75rem; }
    .server-card { background: var(--overlay); border: 1px solid var(--border); border-radius: 14px; padding: 0.9rem 1rem; display: flex; flex-direction: column; align-items: stretch; transition: border-color 0.3s, background 0.3s, box-shadow 0.3s; }
    .server-card:hover { border-color: rgba(var(--accent-rgb),0.28); background: rgba(var(--accent-rgb),0.04); box-shadow: 0 0 20px rgba(var(--accent-rgb),0.08); }
    .server-top { display: flex; align-items: center; gap: 0.875rem; }
    .server-badges { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.65rem; flex-wrap: wrap; }
    .server-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
    .server-avatar-ph { width: 42px; height: 42px; border-radius: 50%; background: rgba(var(--accent-rgb),0.10); border: 1px solid rgba(var(--accent-rgb),0.20); display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
    .server-name { font-size: 0.875rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .server-info { min-width: 0; flex: 1; }
    .server-members { font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; }
    .server-presence { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.67rem; font-weight: 600; color: var(--green); background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.18); border-radius: 99px; padding: 0.15rem 0.55rem; white-space: nowrap; flex-shrink: 0; }
    .server-presence::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

    /* Badge */
    .badge { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.67rem; padding: 0.2rem 0.65rem; border-radius: 99px; font-weight: 500; border: 1px solid; }
    .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .badge.green { background: rgba(16,185,129,0.08); color: var(--green); border-color: rgba(16,185,129,0.18); }
    .badge.yellow { background: rgba(245,158,11,0.08); color: var(--yellow); border-color: rgba(245,158,11,0.18); }
    .maint-btn { font-size: 0.68rem; padding: 0.22rem 0.65rem; border-radius: 99px; border: 1px solid rgba(245,158,11,0.22); background: rgba(245,158,11,0.06); color: var(--yellow); cursor: pointer; font-family: inherit; font-weight: 500; transition: background 0.2s, color 0.2s, border-color 0.2s; }
    .maint-btn:hover { background: rgba(245,158,11,0.14); }
    .maint-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .maint-btn.off { border-color: rgba(16,185,129,0.22); background: rgba(16,185,129,0.06); color: var(--green); }
    .maint-btn.off:hover { background: rgba(16,185,129,0.14); }

    .refresh-row { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; font-size: 0.67rem; color: rgba(255,255,255,0.28); }

    /* Guild detail */
    .back-btn { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: var(--muted); cursor: pointer; margin-bottom: 1.5rem; padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid transparent; transition: color 0.2s, border-color 0.2s, background 0.2s; }
    .back-btn:hover { color: var(--text); border-color: var(--border); background: rgba(255,255,255,0.04); }
    .guild-hero { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
    .guild-hero-avatar { width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--border-strong); object-fit: cover; flex-shrink: 0; }
    .guild-hero-avatar-ph { width: 72px; height: 72px; border-radius: 50%; background: rgba(var(--accent-rgb),0.10); border: 2px solid rgba(var(--accent-rgb),0.20); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
    .guild-hero-name { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .guild-hero-id { font-size: 0.72rem; color: var(--muted); margin-top: 0.35rem; font-variant-numeric: tabular-nums; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid transparent; transition: color 0.2s, border-color 0.2s, background 0.2s; }
    .guild-hero-id:hover { color: var(--accent); border-color: rgba(var(--accent-rgb),0.22); background: rgba(var(--accent-rgb),0.06); }
    .guild-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .user-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .user-item { display: flex; align-items: center; gap: 0.875rem; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 12px; transition: border-color 0.2s; }
    .user-item:hover { border-color: var(--border-strong); }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
    .user-avatar-ph { width: 36px; height: 36px; border-radius: 50%; background: rgba(var(--accent-rgb),0.10); border: 1px solid rgba(var(--accent-rgb),0.20); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: var(--accent); flex-shrink: 0; }
    .user-name { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .user-since { font-size: 0.67rem; color: var(--muted); margin-top: 0.1rem; }
    .user-list-empty { text-align: center; color: var(--muted); font-size: 0.82rem; padding: 2rem 0; }
    .server-card { cursor: pointer; }

    /* Stat mini */
    .stat-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .stat-mini-item { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 0.9rem; transition: border-color 0.2s; }
    .stat-mini-item:hover { border-color: var(--border-strong); }
    .stat-mini-label { font-size: 0.61rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.35rem; font-weight: 500; }
    .stat-mini-value { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }

    /* Journal */
    .event-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .event-item { display: flex; align-items: flex-start; gap: 0.875rem; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 12px; transition: border-color 0.2s; }
    .event-item:hover { border-color: var(--border-strong); }
    .event-badge { flex-shrink: 0; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; padding: 0.18rem 0.55rem; border-radius: 99px; border: 1px solid; }
    .event-badge.START { background: rgba(16,185,129,0.10); color: var(--green); border-color: rgba(16,185,129,0.22); }
    .event-badge.STOP { background: rgba(245,158,11,0.10); color: var(--yellow); border-color: rgba(245,158,11,0.22); }
    .event-badge.CRASH { background: rgba(239,68,68,0.10); color: var(--red); border-color: rgba(239,68,68,0.22); }
    .event-badge.ERROR { background: rgba(239,68,68,0.10); color: var(--red); border-color: rgba(239,68,68,0.22); }
    .event-body { flex: 1; min-width: 0; }
    .event-msg { font-size: 0.82rem; color: var(--text); word-break: break-word; }
    .event-time { font-size: 0.67rem; color: var(--muted); margin-top: 0.2rem; font-variant-numeric: tabular-nums; }
    .event-empty { text-align: center; color: var(--muted); font-size: 0.82rem; padding: 2rem 0; }
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
      <a class="nav-item" onclick="navigate('journal')" data-page="journal">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
        Journal
      </a>
    </nav>
    <div class="sidebar-footer">
      <a href="/auth/logout" class="logout-btn">← Déconnexion</a>
    </div>
  </aside>

  <main class="content">
    <div class="page-glow"></div>
    <div class="content-inner">

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
          <div class="card clickable" onclick="navigate('servers')">
            <div class="card-icon green"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>
            <div class="card-label">Clients connectés</div>
            <div class="card-value" id="h-clients">—</div>
            <div class="card-hint">En temps réel →</div>
          </div>
          <div class="card clickable" onclick="navigate('messages')">
            <div class="card-icon yellow"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
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
            <div class="card-label">Attente file moy.</div>
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
          <div style="display:flex;align-items:center;gap:0.6rem">
            <span class="badge green" id="status-badge">En ligne</span>
            <button class="maint-btn" id="maint-btn" onclick="toggleMaintenance()">🔧 Maintenance</button>
          </div>
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
            <div class="card-label">Attente file moy.</div>
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
            <div class="section-title">Attente en file — 50 derniers envois</div>
            <svg class="sparkline-svg" id="sparkline" viewBox="0 0 400 72" preserveAspectRatio="none">
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#5865f2" stop-opacity="0.22"/>
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
            <div style="margin-top:1.25rem">
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

      <!-- GUILD DETAIL -->
      <div class="page" id="page-guild">
        <div class="back-btn" onclick="navigate('servers')">← Retour aux serveurs</div>
        <div class="guild-hero">
          <div id="g-avatar-wrap"></div>
          <div>
            <div class="guild-hero-name" id="g-name"></div>
            <div class="guild-hero-id" id="g-id" onclick="copyGuildId()" title="Cliquer pour copier l\'ID"></div>
          </div>
        </div>
        <div class="guild-stats">
          <div class="card">
            <div class="card-label">Membres total</div>
            <div class="card-value" id="g-members">—</div>
          </div>
          <div class="card">
            <div class="card-label">Clients connectés</div>
            <div class="card-value" id="g-connected">—</div>
          </div>
          <div class="card">
            <div class="card-label">Statut</div>
            <div class="card-value" id="g-status" style="font-size:1rem">—</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Clients connectés dans la room</div>
          <div id="g-user-list" class="user-list">
            <div class="user-list-empty">Aucun client connecté.</div>
          </div>
        </div>
      </div>

      <!-- JOURNAL -->
      <div class="page" id="page-journal">
        <div class="page-header">
          <div class="page-title">Journal des événements</div>
          <div class="page-subtitle">Démarrages, arrêts, crashs et erreurs du bot — 100 derniers événements</div>
        </div>
        <div class="section">
          <div id="journal-list" class="event-list">
            <div class="event-empty">Chargement...</div>
          </div>
        </div>
      </div>

    </div>
  </main>
</div>
<script>
  function updateMaintenanceUI(silentMode) {
    const badge = document.getElementById('status-badge');
    const btn = document.getElementById('maint-btn');
    if (silentMode) {
      badge.className = 'badge yellow'; badge.textContent = 'Maintenance';
      btn.className = 'maint-btn off'; btn.textContent = '🟢 Reprendre';
    } else {
      badge.className = 'badge green'; badge.textContent = 'En ligne';
      btn.className = 'maint-btn'; btn.textContent = '🔧 Maintenance';
    }
  }

  async function toggleMaintenance() {
    const btn = document.getElementById('maint-btn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/maintenance/toggle', { method: 'POST' });
      if (res.ok) { const d = await res.json(); updateMaintenanceUI(d.silentMode); }
    } catch(e) { console.error(e); }
    finally { btn.disabled = false; }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const navEl = document.querySelector('[data-page="' + page + '"]');
    if (navEl) navEl.classList.add('active');
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

  var cachedGuilds = null;
  var cachedPresence = {};
  var currentGuildId = null;

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return h + 'h ' + (m % 60) + 'min';
    if (m > 0) return m + 'min ' + (s % 60) + 's';
    return s + 's';
  }

  function openGuild(id) {
    currentGuildId = id;
    const guild = cachedGuilds && cachedGuilds.find(g => g.id === id);
    if (!guild) return;
    const avatarWrap = document.getElementById('g-avatar-wrap');
    avatarWrap.innerHTML = guild.icon
      ? '<img class="guild-hero-avatar" src="' + esc(guild.icon) + '" alt="">'
      : '<div class="guild-hero-avatar-ph">' + esc(guild.name.charAt(0).toUpperCase()) + '</div>';
    document.getElementById('g-name').textContent = guild.name;
    document.getElementById('g-id').textContent = '🆔 ' + id;
    document.getElementById('g-members').textContent = fmt(guild.memberCount);
    const statusEl = document.getElementById('g-status');
    statusEl.textContent = guild.isSetup ? 'Configuré' : 'Non configuré';
    statusEl.style.color = guild.isSetup ? 'var(--green)' : 'var(--yellow)';
    renderGuildPresence(id);
    navigate('guild');
  }

  function renderGuildPresence(guildId) {
    const clients = (cachedPresence && cachedPresence[guildId]) || [];
    document.getElementById('g-connected').textContent = fmt(clients.length);
    const el = document.getElementById('g-user-list');
    if (clients.length === 0) {
      el.innerHTML = '<div class="user-list-empty">Aucun client connecté.</div>';
      return;
    }
    const now = Date.now();
    el.innerHTML = clients.map(c => {
      const since = c.connectedAt ? fmtDuration(now - new Date(c.connectedAt).getTime()) : '—';
      const av = c.avatarUrl
        ? '<img class="user-avatar" src="' + esc(c.avatarUrl) + '" alt="">'
        : '<div class="user-avatar-ph">' + esc((c.displayName || '?').charAt(0).toUpperCase()) + '</div>';
      return '<div class="user-item">' + av + '<div><div class="user-name">' + esc(c.displayName) + '</div><div class="user-since">Connecté depuis ' + esc(since) + '</div></div></div>';
    }).join('');
  }

  function copyGuildId() {
    if (!currentGuildId) return;
    navigator.clipboard.writeText(currentGuildId).then(() => {
      const el = document.getElementById('g-id');
      const orig = el.textContent;
      el.textContent = '✓ Copié !';
      setTimeout(() => { el.textContent = orig; }, 1500);
    });
  }

  function renderServers(guilds, presence) {
    cachedGuilds = guilds;
    const sorted=(guilds||[]).sort((a,b)=>b.memberCount-a.memberCount);
    const configured = sorted.filter(g => g.isSetup).length;
    document.getElementById('s-subtitle').textContent = sorted.length+' serveur'+(sorted.length>1?'s':'')+' connecté'+(sorted.length>1?'s':'')+' / '+configured+' configuré'+(configured>1?'s':'');
    document.getElementById('server-grid').innerHTML = sorted.map(g => {
      const av = g.icon ? '<img class="server-avatar" src="'+esc(g.icon)+'" alt="">' : '<div class="server-avatar-ph">'+esc(g.name.charAt(0).toUpperCase())+'</div>';
      const clients = (presence && presence[g.id]) || [];
      const presenceBadge = clients.length > 0
        ? '<span class="server-presence" title="'+esc(clients.map(c=>c.displayName).join(', '))+'">'+clients.length+' client'+(clients.length>1?'s':'')+' en ligne</span>'
        : '';
      const setupBadge = g.isSetup
        ? '<span class="badge green">Configuré</span>'
        : '<span class="badge yellow">Non configuré</span>';
      return '<div class="server-card" data-guild-id="'+esc(g.id)+'"><div class="server-top">'+av+'<div class="server-info"><div class="server-name">'+esc(g.name)+'</div><div class="server-members">'+fmt(g.memberCount)+' membres</div></div></div><div class="server-badges">'+setupBadge+presenceBadge+'</div></div>';
    }).join('');
  }

  function updatePresenceLive(presence) {
    const total = Object.values(presence).reduce((sum, arr) => sum + arr.length, 0);
    const el = document.getElementById('h-clients');
    if (el) el.textContent = fmt(total);

    // Update presence badges on server cards without full re-render
    const cards = document.querySelectorAll('[data-guild-id]');
    for (const card of cards) {
      const guildId = card.getAttribute('data-guild-id');
      const badgesEl = card.querySelector('.server-badges');
      if (!badgesEl) continue;
      const guild = cachedGuilds && cachedGuilds.find(g => g.id === guildId);
      if (!guild) continue;
      const clients = (presence && presence[guildId]) || [];
      const presenceBadge = clients.length > 0
        ? '<span class="server-presence" title="'+esc(clients.map(c=>c.displayName).join(', '))+'">'+clients.length+' client'+(clients.length>1?'s':'')+' en ligne</span>'
        : '';
      const setupBadge = guild.isSetup
        ? '<span class="badge green">Configuré</span>'
        : '<span class="badge yellow">Non configuré</span>';
      badgesEl.innerHTML = setupBadge + presenceBadge;
    }
  }

  function renderJournal(events) {
    const el = document.getElementById('journal-list');
    if (!events || events.length === 0) {
      el.innerHTML = '<div class="event-empty">Aucun événement enregistré.</div>';
      return;
    }
    el.innerHTML = events.map(e => {
      const d = new Date(e.createdAt);
      const abs = d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR');
      const msg = e.message ? '<div class="event-msg">'+esc(e.message)+'</div>' : '';
      const safeType = esc(e.type);
      return '<div class="event-item"><span class="event-badge '+safeType+'">'+safeType+'</span><div class="event-body">'+msg+'<div class="event-time">'+esc(abs)+'</div></div></div>';
    }).join('');
  }

  async function refresh() {
    try {
      const res = await fetch('/api/stats');
      if (res.status === 401) { window.top.location.href = '/dashboard'; return; }
      const d = await res.json();
      const now = 'Mis à jour à ' + new Date().toLocaleTimeString('fr-FR');
      const sys = d.system || {};

      updateMaintenanceUI(d.silentMode ?? false);

      // Accueil
      document.getElementById('h-servers').textContent = fmt(d.guilds?.length ?? 0);
      document.getElementById('h-totalSent').textContent = fmt(d.totalSent);
      document.getElementById('h-uptime').textContent = fmtUptime(d.uptime);
      document.getElementById('h-latency').textContent = d.latency?.avgMs > 0 ? fmtMs(d.latency.avgMs) : '—';
      document.getElementById('h-cpu').textContent = (sys.cpuPercent ?? 0) + '%';
      document.getElementById('h-mem').textContent = fmtBytes((sys.memRssMB ?? 0) * 1048576);
      document.getElementById('h-refresh').textContent = now;
      const totalClients = Object.values(d.presence || {}).reduce((sum, arr) => sum + arr.length, 0);
      document.getElementById('h-clients').textContent = fmt(totalClients);

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
      cachedPresence = d.presence || {};
      renderServers(d.guilds, d.presence);

      // Journal
      renderJournal(d.events);

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

  document.getElementById('server-grid').addEventListener('click', function(e) {
    const card = e.target.closest('[data-guild-id]');
    if (card) openGuild(card.getAttribute('data-guild-id'));
  });

  // Real-time presence updates via SSE
  (function initPresenceSse() {
    function connect() {
      const sse = new EventSource('/api/presence-events');
      sse.addEventListener('presence', function(e) {
        try {
          const p = JSON.parse(e.data);
          cachedPresence = p;
          updatePresenceLive(p);
          if (currentGuildId) renderGuildPresence(currentGuildId);
        } catch {}
      });
      sse.onerror = function() {
        sse.close();
        setTimeout(connect, 5000);
      };
    }
    connect();
  })();
</script>
</body>
</html>`;

async function dashboardPlugin(fastify: FastifyCustomInstance) {
  const redirectUri = `${env.API_URL}/auth/callback`;
  const oauthUrl =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${env.DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=identify`;

  fastify.get('/dashboard', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (!isValidSession(token)) {
      const redirectPage = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script>window.top.location.href=${JSON.stringify(oauthUrl)};</script></head><body></body></html>`;
      return reply.type('text/html').send(redirectPage);
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
    reply.header('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`);
    return reply.redirect('/dashboard', 302);
  });

  fastify.post('/api/maintenance/toggle', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (!isValidSession(token)) return reply.status(401).send({ error: 'Unauthorized' });

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

  fastify.get('/auth/logout', async (req, reply) => {
    const token = getSessionToken(req.headers.cookie);
    if (token) deleteSession(token);
    reply.header('Set-Cookie', 'session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0');
    return reply.redirect('/dashboard', 302);
  });
}

export const DashboardRoutes = () => dashboardPlugin;
