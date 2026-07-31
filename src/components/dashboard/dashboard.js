  const _csrf = document.querySelector('meta[name="csrf-token"]').content;

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': _csrf } });
    window.top.location.href = '/dashboard';
  }

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
      const res = await fetch('/api/maintenance/toggle', { method: 'POST', headers: { 'X-CSRF-Token': _csrf } });
      if (res.ok) { const d = await res.json(); updateMaintenanceUI(d.silentMode); }
    } catch(e) { console.error(e); }
    finally { btn.disabled = false; }
  }

  function esc(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const navEl = document.querySelector('[data-page="' + page + '"]');
    if (navEl) navEl.classList.add('active');
    if (page === 'database') { loadDatabase(); }
  }

  const fmt = n => Number(n).toLocaleString('fr-FR');
  const fmtMs = ms => ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms + 'ms';

  function fmtBytes(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
  }

  function fmtUptime(s) {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    if (d > 0) return d + 'j ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm ' + sec + 's';
  }

  const fmtLatStat = ms => ms > 0 ? fmtMs(ms) : '—';

  function cpuBarClass(pct) {
    if (pct > 80) return 'sys-bar red';
    if (pct > 50) return 'sys-bar yellow';
    return 'sys-bar accent';
  }

  function ramBarClass(pct) {
    if (pct > 85) return 'sys-bar red';
    if (pct > 65) return 'sys-bar yellow';
    return 'sys-bar green';
  }

  function renderSparkline(samples) {
    if (!samples || samples.length < 2) return;
    const W = 400, H = 72, p = 5;
    const mn = Math.min(...samples), mx = Math.max(...samples), rng = mx - mn || 1;
    const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const pts = samples.map((v, i) => [(p + (i / (samples.length - 1)) * (W - p * 2)).toFixed(1), (H - p - ((v - mn) / rng) * (H - p * 2)).toFixed(1)]);
    const line = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ',' + pt[1]).join(' ');
    document.getElementById('spark-line').setAttribute('d', line);
    document.getElementById('spark-area').setAttribute('d', line + ' L' + pts[pts.length - 1][0] + ',' + H + ' L' + p + ',' + H + ' Z');
    document.getElementById('spark-min').textContent = 'min ' + fmtMs(mn);
    document.getElementById('spark-avg').textContent = 'moy ' + fmtMs(avg);
    document.getElementById('spark-max').textContent = 'max ' + fmtMs(mx);
  }

  let cachedGuilds = null;
  let cachedPresence = {};
  let currentGuildId = null;

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return h + 'h ' + (m % 60) + 'min';
    if (m > 0) return m + 'min ' + (s % 60) + 's';
    return s + 's';
  }

  function openGuild(id) {
    currentGuildId = id;
    const guild = cachedGuilds?.find(g => g.id === id);
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
    const clients = cachedPresence?.[guildId] ?? [];
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
    const sorted = (guilds || []).sort((a, b) => b.memberCount - a.memberCount);
    const configured = sorted.filter(g => g.isSetup).length;
    document.getElementById('s-subtitle').textContent = sorted.length + ' serveur' + (sorted.length > 1 ? 's' : '') + ' connecté' + (sorted.length > 1 ? 's' : '') + ' / ' + configured + ' configuré' + (configured > 1 ? 's' : '');
    document.getElementById('server-grid').innerHTML = sorted.map(g => {
      const av = g.icon ? '<img class="server-avatar" src="' + esc(g.icon) + '" alt="">' : '<div class="server-avatar-ph">' + esc(g.name.charAt(0).toUpperCase()) + '</div>';
      const clients = presence?.[g.id] ?? [];
      const presenceBadge = clients.length > 0
        ? '<span class="server-presence" title="' + esc(clients.map(c => c.displayName).join(', ')) + '">' + clients.length + ' client' + (clients.length > 1 ? 's' : '') + ' en ligne</span>'
        : '';
      const setupBadge = g.isSetup ? '<span class="badge green">Configuré</span>' : '<span class="badge yellow">Non configuré</span>';
      return '<div class="server-card" data-guild-id="' + esc(g.id) + '"><div class="server-top">' + av + '<div class="server-info"><div class="server-name">' + esc(g.name) + '</div><div class="server-members">' + fmt(g.memberCount) + ' membres</div></div></div><div class="server-badges">' + setupBadge + presenceBadge + '</div></div>';
    }).join('');
  }

  function updatePresenceLive(presence) {
    const total = Object.values(presence).reduce((sum, arr) => sum + arr.length, 0);
    const el = document.getElementById('h-clients');
    if (el) el.textContent = fmt(total);

    const cards = document.querySelectorAll('[data-guild-id]');
    for (const card of cards) {
      const guildId = card.dataset.guildId;
      const badgesEl = card.querySelector('.server-badges');
      if (!badgesEl) continue;
      const guild = cachedGuilds?.find(g => g.id === guildId);
      if (!guild) continue;
      const clients = presence?.[guildId] ?? [];
      const presenceBadge = clients.length > 0
        ? '<span class="server-presence" title="' + esc(clients.map(c => c.displayName).join(', ')) + '">' + clients.length + ' client' + (clients.length > 1 ? 's' : '') + ' en ligne</span>'
        : '';
      const setupBadge = guild.isSetup ? '<span class="badge green">Configuré</span>' : '<span class="badge yellow">Non configuré</span>';
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
      const abs = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR');
      const msg = e.message ? '<div class="event-msg">' + esc(e.message) + '</div>' : '';
      const safeType = esc(e.type);
      return '<div class="event-item"><span class="event-badge ' + safeType + '">' + safeType + '</span><div class="event-body">' + msg + '<div class="event-time">' + esc(abs) + '</div></div></div>';
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

      document.getElementById('h-servers').textContent = fmt(d.guilds?.length ?? 0);
      document.getElementById('h-totalSent').textContent = fmt(d.totalSent);
      document.getElementById('h-uptime').textContent = fmtUptime(d.uptime);
      document.getElementById('h-latency').textContent = fmtLatStat(d.latency?.avgMs);
      document.getElementById('h-cpu').textContent = (sys.cpuPercent ?? 0) + '%';
      document.getElementById('h-mem').textContent = fmtBytes((sys.memRssMB ?? 0) * 1048576);
      document.getElementById('h-refresh').textContent = now;
      const totalClients = Object.values(d.presence || {}).reduce((sum, arr) => sum + arr.length, 0);
      document.getElementById('h-clients').textContent = fmt(totalClients);

      document.getElementById('m-total').textContent = fmt(d.totalSent);
      document.getElementById('m-latency').textContent = fmtLatStat(d.latency?.avgMs);
      document.getElementById('m-queue').textContent = fmt(d.queuePending);
      const total = d.totalSent || 1;
      for (const t of ['image', 'video', 'audio', 'link', 'text']) {
        const count = d.byType[t] ?? 0;
        const pct = Math.round((count / total) * 100);
        document.getElementById('count-' + t).textContent = fmt(count);
        document.getElementById('pct-' + t).textContent = pct + '%';
        document.getElementById('bar-' + t).style.width = pct + '%';
      }
      renderSparkline(d.latency?.samples);
      document.getElementById('lat-ingestion').textContent = fmtLatStat(d.latency?.avgIngestionMs);
      document.getElementById('lat-processing').textContent = fmtLatStat(d.latency?.avgProcessingMs);
      document.getElementById('lat-queuewait').textContent = fmtLatStat(d.latency?.avgQueueWaitMs);
      document.getElementById('lat-emit').textContent = fmtLatStat(d.latency?.avgEmitMs);

      cachedPresence = d.presence || {};
      renderServers(d.guilds, d.presence);
      renderJournal(d.events);

      const cpuPct = sys.cpuPercent ?? 0;
      document.getElementById('n-cpu').textContent = cpuPct + '%';
      const cpuBar = document.getElementById('n-cpu-bar');
      cpuBar.style.width = Math.min(100, cpuPct) + '%';
      cpuBar.className = cpuBarClass(cpuPct);

      const usedMB = (sys.memTotalMB ?? 0) - (sys.memFreeMB ?? 0);
      const sysPct = sys.memTotalMB ? Math.round(usedMB / sys.memTotalMB * 100) : 0;
      document.getElementById('n-sysram').textContent = fmtBytes(usedMB * 1048576) + ' / ' + fmtBytes((sys.memTotalMB ?? 0) * 1048576);
      const sysBar = document.getElementById('n-sysram-bar');
      sysBar.style.width = sysPct + '%';
      sysBar.className = ramBarClass(sysPct);

      const heapPct = sys.memHeapTotalMB ? Math.round(sys.memHeapUsedMB / sys.memHeapTotalMB * 100) : 0;
      document.getElementById('n-heap').textContent = fmtBytes((sys.memHeapUsedMB ?? 0) * 1048576) + ' / ' + fmtBytes((sys.memHeapTotalMB ?? 0) * 1048576);
      document.getElementById('n-heap-bar').style.width = heapPct + '%';
      document.getElementById('n-rss').textContent = fmtBytes((sys.memRssMB ?? 0) * 1048576);

      document.getElementById('n-load1').textContent = (sys.loadAvg?.[0] ?? 0).toFixed(2);
      document.getElementById('n-load5').textContent = (sys.loadAvg?.[1] ?? 0).toFixed(2);
      document.getElementById('n-load15').textContent = (sys.loadAvg?.[2] ?? 0).toFixed(2);

      const bytes = d.latency?.totalPayloadBytes ?? 0;
      document.getElementById('n-payload').textContent = fmtBytes(bytes);
      document.getElementById('n-total').textContent = fmt(d.totalSent);
      document.getElementById('n-avg-payload').textContent = d.totalSent > 0 ? fmtBytes(Math.round(bytes / d.totalSent)) : '—';
      document.getElementById('n-refresh').textContent = now;

      if (document.getElementById('page-database').classList.contains('active')) loadDatabase();
    } catch(e) { console.error(e); }
  }

  async function loadDatabase() {
    try {
      const res = await fetch('/api/admin/db/guilds');
      if (res.status === 401) { window.top.location.href = '/dashboard'; return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      renderGuildTable(await res.json());
    } catch(e) {
      console.error(e);
      document.getElementById('db-guild-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:2rem">Erreur de chargement.</td></tr>';
    }
  }

  function buildBroadcastCell(lastBroadcast) {
    if (!lastBroadcast) return '<span class="db-broadcast-none">—</span>';
    const bAt = lastBroadcast.at ? new Date(lastBroadcast.at) : null;
    const bTime = bAt ? '<span class="db-broadcast-time">' + bAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + bAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>' : '';
    if (lastBroadcast.status === 'SUCCESS') return '<span class="db-broadcast-ok">✓ OK' + bTime + '</span>';
    if (lastBroadcast.status === 'FAILED') {
      const reason = lastBroadcast.errorReason ? ' · ' + esc(lastBroadcast.errorReason) : '';
      return '<span class="db-broadcast-fail">✗ Échec' + reason + bTime + '</span>';
    }
    return '<span class="db-broadcast-none">—</span>';
  }

  function buildGuildRow(r) {
    const safeId = esc(r.id);
    const av = r.icon
      ? '<img class="db-guild-avatar" src="' + esc(r.icon) + '" alt="">'
      : '<div class="db-guild-ph">' + esc((r.name || r.id).charAt(0).toUpperCase()) + '</div>';
    const nameCell = '<div class="db-guild-cell">' + av + '<span class="db-guild-name">' + esc(r.name || r.id) + '</span></div>';
    const copyId = '<button class="db-copy-btn" data-copy="' + safeId + '">' + safeId + '</button>';
    const copyChannel = r.channelId
      ? '<button class="db-copy-btn" data-copy="' + esc(r.channelId) + '">' + esc(r.channelId) + '</button>'
      : '<span style="color:var(--muted)">—</span>';
    const times = (r.defaultMediaTime != null ? r.defaultMediaTime : '—') + 's / ' + (r.maxMediaTime != null ? r.maxMediaTime : '—') + 's';
    const fullMedia = r.displayMediaFull ? '<span class="badge green">Oui</span>' : '<span style="color:var(--muted);font-size:0.78rem">Non</span>';
    const connectedCell = r.connected
      ? '<span style="color:var(--green);font-size:0.78rem">✓</span>'
      : '<span class="disconnected-badge">Déconnecté</span>';
    return '<tr class="' + (r.lastBroadcast?.status === 'FAILED' ? 'row-failed' : '') + '" id="db-row-' + safeId + '">'
      + '<td>' + nameCell + '</td>'
      + '<td>' + copyId + '</td>'
      + '<td>' + copyChannel + '</td>'
      + '<td style="font-size:0.78rem">' + esc(times) + '</td>'
      + '<td>' + fullMedia + '</td>'
      + '<td>' + buildBroadcastCell(r.lastBroadcast) + '</td>'
      + '<td>' + connectedCell + '</td>'
      + '<td><button class="db-del-btn" data-delete-guild="' + safeId + '">Supprimer</button></td>'
      + '</tr>';
  }

  function renderGuildTable(rows) {
    document.getElementById('db-connected-count').textContent = rows.filter(r => r.connected).length;
    document.getElementById('db-total-count').textContent = rows.length;
    document.getElementById('db-failed-count').textContent = rows.filter(r => r.lastBroadcast?.status === 'FAILED').length;

    if (rows.length === 0) {
      document.getElementById('db-guild-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem">Aucune guilde configurée.</td></tr>';
      return;
    }
    document.getElementById('db-guild-tbody').innerHTML = rows.map(buildGuildRow).join('');
  }

  async function deleteGuild(id, btn) {
    if (!confirm('Supprimer la configuration de la guilde ' + id + ' ?\n\nCette action est irréversible.')) return;
    btn.disabled = true;
    try {
      const res = await fetch('/api/admin/db/guilds/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'X-CSRF-Token': _csrf } });
      if (res.status === 401) { window.top.location.href = '/dashboard'; return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      document.getElementById('db-row-' + id)?.remove();
      showToast('Guilde supprimée.');
      document.getElementById('db-total-count').textContent = document.querySelectorAll('#db-guild-tbody tr[id^="db-row-"]').length;
    } catch(e) {
      console.error(e);
      showToast('Erreur lors de la suppression.', true);
      btn.disabled = false;
    }
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }

  function showToast(msg, isError) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  refresh();
  setInterval(refresh, 30000);

  document.getElementById('server-grid').addEventListener('click', function(e) {
    const card = e.target.closest('[data-guild-id]');
    if (card) openGuild(card.dataset.guildId);
  });

  document.getElementById('db-guild-tbody').addEventListener('click', async function(e) {
    const delBtn = e.target.closest('[data-delete-guild]');
    if (delBtn) { await deleteGuild(delBtn.dataset.deleteGuild, delBtn); return; }
    const copyBtn = e.target.closest('.db-copy-btn[data-copy]');
    if (copyBtn) copyText(copyBtn.dataset.copy, copyBtn);
  });

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
