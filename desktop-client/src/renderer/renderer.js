const state = {
  settings: null,
  displays: [],
  status: { type: 'idle', message: 'Prêt' },
  activeTestFormat: null,
  clients: [],
};

const elements = {
  // Settings (overlay) tab
  toggleOverlayBtn: document.getElementById('toggleOverlayBtn'),
  overlayPosition:  document.getElementById('overlayPosition'),
  screenId:         document.getElementById('screenId'),
  overlaySize:      document.getElementById('overlaySize'),
  sizeValue:        document.getElementById('sizeValue'),
  volume:           document.getElementById('volume'),
  volumeValue:      document.getElementById('volumeValue'),
  testLandscapeBtn: document.getElementById('testLandscapeBtn'),
  testSquareBtn:    document.getElementById('testSquareBtn'),
  testPortraitBtn:  document.getElementById('testPortraitBtn'),
  testSoundBtn:     document.getElementById('testSoundBtn'),
  obsUrlSection:    document.getElementById('obsUrlSection'),
  obsUrlDisplay:    document.getElementById('obsUrlDisplay'),
  obsUrlCopyBtn:    document.getElementById('obsUrlCopyBtn'),
  statusSummary:    document.getElementById('statusSummary'),
  windowSummary:    document.getElementById('windowSummary'),
  screenSummary:    document.getElementById('screenSummary'),

  // Server config tab
  backendUrl:       document.getElementById('backendUrl'),
  guildId:          document.getElementById('guildId'),
  clientToken:      document.getElementById('clientToken'),
  localServerPort:  document.getElementById('localServerPort'),
  autoConnect:      document.getElementById('autoConnect'),
  launchAtStartup:  document.getElementById('launchAtStartup'),
  startMinimized:   document.getElementById('startMinimized'),
  testConnBtn:      document.getElementById('testConnBtn'),
  saveConfigBtn:    document.getElementById('saveConfigBtn'),
  testResultBox:    document.getElementById('testResultBox'),
  testResultIcon:   document.getElementById('testResultIcon'),
  testResultText:   document.getElementById('testResultText'),

  // Status tab
  statusDot:        document.getElementById('statusDot'),
  statusText:       document.getElementById('statusText'),
  changelogList:    document.getElementById('changelogList'),

  // Users tab
  presenceSummary:  document.getElementById('presenceSummary'),
  userList:         document.getElementById('userList'),

  // Sidebar footer
  appVersion:       document.getElementById('appVersion'),
};

const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Navigation ────────────────────────────────────────────────────────────────

function switchTab(name) {
  const tabIds = { status: 'tabStatus', settings: 'tabSettings', server: 'tabServer', users: 'tabUsers' };
  for (const [key, id] of Object.entries(tabIds)) {
    const panel = document.getElementById(id);
    if (panel) panel.classList.toggle('hidden', key !== name);
  }
  document.querySelectorAll('.nav-item[data-tab], .sidebar-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
}

// ── Status rendering ───────────────────────────────────────────────────────────

const STATUS_LABELS = { connected: 'Connecté', loading: '...', error: 'Erreur', idle: 'Prêt' };

function renderStatus(status) {
  state.status = status;
  elements.statusText.textContent    = status.message;
  elements.statusSummary.textContent = STATUS_LABELS[status.type] ?? status.type;
  elements.statusDot.dataset.status  = status.type;

  if (status.type === 'connected') {
    startPresencePolling();
    window.livechat.getObsUrl().then(setObsUrl);
  } else {
    stopPresencePolling();
    if (status.type !== 'loading') setObsUrl('');
  }

  const overlayBtnSpan = elements.toggleOverlayBtn.querySelector('span') ?? elements.toggleOverlayBtn;
  if (status.type === 'connected') {
    overlayBtnSpan.textContent             = "Désactiver l'overlay";
    elements.toggleOverlayBtn.className    = 'btn-overlay primary-toggle btn-active';
    elements.toggleOverlayBtn.disabled     = false;
    elements.windowSummary.textContent     = 'Visible';
    elements.testLandscapeBtn.disabled = false;
    elements.testSquareBtn.disabled    = false;
    elements.testPortraitBtn.disabled  = false;
    elements.testSoundBtn.disabled     = false;
  } else {
    state.activeTestFormat = null;
    elements.testLandscapeBtn.classList.remove('active-test');
    elements.testSquareBtn.classList.remove('active-test');
    elements.testPortraitBtn.classList.remove('active-test');

    if (status.type === 'loading') {
      overlayBtnSpan.textContent             = 'Connexion en cours...';
      elements.toggleOverlayBtn.className    = 'btn-overlay primary-toggle btn-inactive';
      elements.toggleOverlayBtn.disabled     = true;
      elements.windowSummary.textContent     = 'Chargement';
    } else {
      overlayBtnSpan.textContent             = "Activer l'overlay";
      elements.toggleOverlayBtn.className    = 'btn-overlay primary-toggle btn-inactive';
      elements.toggleOverlayBtn.disabled     = false;
      elements.windowSummary.textContent     = 'Inactive';
    }
    elements.testLandscapeBtn.disabled = true;
    elements.testSquareBtn.disabled    = true;
    elements.testPortraitBtn.disabled  = true;
    elements.testSoundBtn.disabled     = true;
  }
}

function renderScreenSummary() {
  const selected = state.displays.find(d => String(d.id) === String(elements.screenId.value));
  elements.screenSummary.textContent = selected ? selected.label : 'Écran principal';
}

function renderVolume(value) {
  elements.volumeValue.textContent = `${value}%`;
}

function renderSize(value) {
  elements.sizeValue.textContent = `${value}px`;
}

function setObsUrl(url) {
  if (!elements.obsUrlSection || !elements.obsUrlDisplay) return;
  if (url) {
    elements.obsUrlDisplay.value = url;
    elements.obsUrlSection.classList.remove('hidden');
  } else {
    elements.obsUrlDisplay.value = '';
    elements.obsUrlSection.classList.add('hidden');
  }
}

function populateDisplays(displays) {
  state.displays = displays;
  elements.screenId.innerHTML = '';
  for (const display of displays) {
    const option = document.createElement('option');
    option.value       = String(display.id);
    option.textContent = display.primary ? `${display.label} (principal)` : display.label;
    elements.screenId.appendChild(option);
  }
  renderScreenSummary();
}

// ── Form helpers ───────────────────────────────────────────────────────────────

function readFormValues() {
  return {
    backendUrl:      elements.backendUrl.value.trim(),
    guildId:         elements.guildId.value.trim(),
    clientToken:     elements.clientToken.value.trim(),
    screenId:        Number(elements.screenId.value),
    volume:          Number(elements.volume.value),
    overlaySize:     Number(elements.overlaySize.value),
    overlayPosition: elements.overlayPosition.value,
    autoConnect:     elements.autoConnect.checked,
    launchAtStartup: elements.launchAtStartup.checked,
    startMinimized:  elements.startMinimized.checked,
    clickThrough:    true,
    localServerPort: Math.min(65535, Math.max(1024, Number(elements.localServerPort?.value) || 3001)),
  };
}

async function saveSettings() {
  const settings = await window.livechat.saveSettings(readFormValues());
  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
  return settings;
}

// ── Overlay toggle ─────────────────────────────────────────────────────────────

async function toggleOverlay() {
  if (state.status.type === 'connected') {
    renderStatus({ type: 'loading', message: 'Fermeture...' });
    const status = await window.livechat.disconnect();
    renderStatus(status);
  } else {
    if (!elements.guildId.value.trim()) {
      switchTab('server');
      showTestResult('error', "Renseigne l'ID de ton serveur Discord pour te connecter.");
      return;
    }
    renderStatus({ type: 'loading', message: 'Connexion...' });
    await saveSettings();
    const status = await window.livechat.connect();
    renderStatus(status);
  }
}

// ── Test result box ────────────────────────────────────────────────────────────

let testResultTimeout = null;

function showTestResult(type, message) {
  if (testResultTimeout) {
    clearTimeout(testResultTimeout);
    testResultTimeout = null;
  }
  elements.testResultBox.className = `test-result-box ${type}`;
  elements.testResultText.textContent = message;

  if (elements.testResultIcon) {
    elements.testResultIcon.textContent =
      type === 'success' ? '✓' : type === 'error' ? '✗' : '⏳';
  }

  if (type === 'success' || type === 'error') {
    testResultTimeout = setTimeout(() => {
      elements.testResultBox.classList.add('hidden');
    }, 5000);
  }
}

// ── Connection test ────────────────────────────────────────────────────────────

async function testConnection() {
  const backendUrl = elements.backendUrl.value.trim();
  const guildId    = elements.guildId.value.trim();

  if (!backendUrl || !guildId) {
    showTestResult('error', 'Veuillez remplir les champs URL et Guild ID.');
    return;
  }

  showTestResult('loading', 'Vérification de la connexion au serveur...');
  elements.testConnBtn.disabled = true;

  try {
    const ok = await window.livechat.testConnection(backendUrl, guildId);
    if (ok) {
      showTestResult('success', 'Connexion réussie ! Le serveur répond.');
    } else {
      showTestResult('error', 'Impossible de se connecter. Vérifie les valeurs renseignées.');
    }
  } catch (err) {
    showTestResult('error', `Erreur technique : ${err.message}`);
  } finally {
    elements.testConnBtn.disabled = false;
  }
}

// ── Position grid ──────────────────────────────────────────────────────────────

function updatePositionGridActive(positionValue) {
  for (const cell of document.querySelectorAll('.position-cell')) {
    cell.classList.toggle('active', cell.dataset.value === positionValue);
  }
}

// ── Initial UI load ────────────────────────────────────────────────────────────

async function refreshUi() {
  const [settings, displays, version] = await Promise.all([
    window.livechat.getSettings(),
    window.livechat.getDisplays(),
    window.livechat.getVersion(),
  ]);

  state.settings = settings;
  populateDisplays(displays);

  if (elements.appVersion) elements.appVersion.textContent = `v${version}`;

  elements.backendUrl.value      = settings.backendUrl;
  elements.guildId.value         = settings.guildId;
  elements.clientToken.value     = settings.clientToken;
  elements.autoConnect.checked   = settings.autoConnect;
  elements.launchAtStartup.checked = settings.launchAtStartup;
  elements.startMinimized.checked  = settings.startMinimized;
  if (elements.localServerPort) elements.localServerPort.value = String(settings.localServerPort ?? 3001);

  elements.screenId.value      = String(settings.screenId || displays.find(d => d.primary)?.id || displays[0]?.id || 0);
  elements.volume.value        = String(settings.volume);
  elements.overlaySize.value   = String(settings.overlaySize || 960);
  elements.overlayPosition.value = settings.overlayPosition || 'center';
  updatePositionGridActive(settings.overlayPosition || 'center');

  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
}

// ── Changelog ─────────────────────────────────────────────────────────────────

let changelogLoaded = false;

async function loadChangelog() {
  if (changelogLoaded) return;
  const list = elements.changelogList;
  if (!list) return;

  try {
    const res = await fetch('https://api.github.com/repos/Jeremie-pires/livechat-overlay/releases');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const releases = await res.json();
    changelogLoaded = true;

    if (!releases.length) {
      list.innerHTML = '<li class="changelog-loading">Aucune version disponible.</li>';
      return;
    }

    list.innerHTML = releases.slice(0, 15).map(r => {
      const date = new Date(r.published_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
      const body = r.body
        ? r.body.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : '';
      return `<li class="changelog-item">
        <div class="changelog-item-header">
          <span class="changelog-version">${r.tag_name}</span>
          <span class="changelog-date">${date}</span>
        </div>${body ? `<p class="changelog-body">${body}</p>` : ''}
      </li>`;
    }).join('');
  } catch {
    if (!changelogLoaded) {
      list.innerHTML = '<li class="changelog-offline">Connexion indisponible</li>';
    }
  }
}

// ── Presence ──────────────────────────────────────────────────────────────────

let presenceInterval          = null;
let presenceCleanup           = null;
let presenceUserJoinedCleanup = null;
let presenceUserLeftCleanup   = null;

function updatePresenceSummary(clients) {
  if (!elements.presenceSummary) return;
  const count = clients.length;
  elements.presenceSummary.textContent = count === 0 ? '—' : String(count);
  const badge = document.getElementById('presenceBadge');
  if (badge) badge.textContent = String(count);
  elements.presenceSummary.title = clients.map(c => c.displayName).join(', ');
  elements.presenceSummary.setAttribute(
    'aria-label',
    `${count} utilisateur${count !== 1 ? 's' : ''} connecté${count !== 1 ? 's' : ''}`,
  );
}

let _warnedMissingPresenceId = false;

function buildUserItem(client) {
  if (!client.id) {
    if (!_warnedMissingPresenceId) {
      console.warn('[presence] entry with missing id skipped');
      _warnedMissingPresenceId = true;
    }
    return null;
  }

  const item = document.createElement('div');
  item.className = 'user-item';
  item.setAttribute('role', 'listitem');
  item.setAttribute('data-user-id', client.id);

  if (client.avatarUrl) {
    const img = document.createElement('img');
    img.className = 'user-avatar';
    img.src = client.avatarUrl;
    img.alt = '';
    item.appendChild(img);
  } else {
    const initial = document.createElement('div');
    initial.className = 'user-avatar user-avatar-initial';
    initial.setAttribute('aria-hidden', 'true');
    initial.textContent = client.displayName.charAt(0).toUpperCase();
    item.appendChild(initial);
  }

  const info = document.createElement('div');
  info.className = 'user-info';

  const name = document.createElement('span');
  name.className = 'user-name';
  name.textContent = client.displayName;
  info.appendChild(name);

  const since = document.createElement('span');
  since.className = 'user-since';
  const mins = Math.floor((Date.now() - client.connectedAt) / 60000);
  since.textContent = mins < 1 ? "À l'instant" : `il y a ${mins} min`;
  info.appendChild(since);

  item.appendChild(info);
  return item;
}

function showEmptyPlaceholder() {
  if (!elements.userList) return;
  if (elements.userList.querySelector('.user-list-empty')) return;
  const empty = document.createElement('div');
  empty.className = 'user-list-empty';
  empty.textContent = "Personne n'est connecté.";
  elements.userList.appendChild(empty);
}

function addUserToList(client) {
  if (!elements.userList || !client.id) return;
  if (elements.userList.querySelector(`[data-user-id="${client.id}"]`)) return;

  const empty = elements.userList.querySelector('.user-list-empty');
  if (empty) empty.remove();

  const item = buildUserItem(client);
  if (!item) return;

  if (!noMotion) {
    item.classList.add('user-item-entering');
    item.addEventListener('animationend', () => item.classList.remove('user-item-entering'), { once: true });
  }
  elements.userList.appendChild(item);
}

function removeUserFromList(id) {
  if (!elements.userList) return;
  const item = elements.userList.querySelector(`[data-user-id="${id}"]`);
  if (!item) return;

  const onRemoved = () => {
    item.remove();
    if (elements.userList && !elements.userList.querySelector('.user-item')) showEmptyPlaceholder();
  };

  if (noMotion) { onRemoved(); return; }

  const height = item.getBoundingClientRect().height;
  item.style.overflow  = 'hidden';
  item.style.maxHeight = `${height}px`;
  void item.offsetHeight;
  item.style.transition    = 'opacity 160ms ease-in, max-height 160ms ease-in, padding 160ms ease-in, margin 160ms ease-in';
  item.style.opacity       = '0';
  item.style.maxHeight     = '0';
  item.style.paddingTop    = '0';
  item.style.paddingBottom = '0';
  item.style.marginBottom  = '0';
  item.addEventListener('transitionend', onRemoved, { once: true });
}

function reconcileUserList(snapshot) {
  if (!elements.userList) return;
  const valid       = snapshot.filter(c => c.id);
  const snapshotMap = new Map(valid.map(c => [c.id, c]));

  for (const domItem of elements.userList.querySelectorAll('.user-item[data-user-id]')) {
    if (!snapshotMap.has(domItem.getAttribute('data-user-id'))) domItem.remove();
  }

  for (const client of valid) {
    if (!elements.userList.querySelector(`[data-user-id="${client.id}"]`)) {
      const empty = elements.userList.querySelector('.user-list-empty');
      if (empty) empty.remove();
      const item = buildUserItem(client);
      if (item) elements.userList.appendChild(item);
    }
  }

  if (valid.length === 0 && !elements.userList.querySelector('.user-item')) showEmptyPlaceholder();
}

function updatePresence(clients) {
  state.clients = clients;
  updatePresenceSummary(clients);
  reconcileUserList(clients);
}

function startPresencePolling() {
  if (presenceInterval) return;
  window.livechat.getPresence().then(updatePresence);
  presenceInterval = setInterval(async () => {
    updatePresence(await window.livechat.getPresence());
  }, 60000);
}

function stopPresencePolling() {
  if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
  if (elements.presenceSummary) { elements.presenceSummary.textContent = '—'; elements.presenceSummary.title = ''; }
  state.clients = [];
  reconcileUserList([]);
}

function setupPresenceListeners() {
  if (presenceCleanup) return;

  presenceCleanup = window.livechat.onPresence(snapshot => updatePresence(snapshot));

  presenceUserJoinedCleanup = window.livechat.onUserJoined(data => {
    const client = { id: data.id, displayName: data.displayName, avatarUrl: data.avatarUrl, connectedAt: data.connectedAt };
    state.clients = [...state.clients.filter(c => c.id !== data.id), client];
    addUserToList(client);
    updatePresenceSummary(state.clients);
  });

  presenceUserLeftCleanup = window.livechat.onUserLeft(data => {
    state.clients = state.clients.filter(c => c.id !== data.id);
    removeUserFromList(data.id);
    updatePresenceSummary(state.clients);
  });
}

// ── Event binding ──────────────────────────────────────────────────────────────

function bindEvents() {
  // Navigation (nav items + top-bar icon buttons)
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      switchTab(tab);
      if (tab === 'status') loadChangelog();
    });
  });

  // External link buttons (Discord, GitHub)
  for (const id of ['discordSupportBtn', 'githubBtn']) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        const url = btn.dataset.href;
        if (url) window.livechat.openExternal(url);
      });
    }
  }

  // Overlay toggle
  elements.toggleOverlayBtn.addEventListener('click', toggleOverlay);

  // Server config
  elements.testConnBtn.addEventListener('click', testConnection);
  elements.saveConfigBtn.addEventListener('click', async () => {
    await saveSettings();
    showTestResult('success', 'Configuration enregistrée !');
    setTimeout(() => {
      elements.testResultBox.classList.add('hidden');
    }, 3000);
  });

  // Screen / position / size / volume
  elements.screenId.addEventListener('change', async () => {
    await saveSettings();
    await window.livechat.refreshPlacement();
  });

  elements.overlayPosition.addEventListener('change', saveSettings);

  for (const cell of document.querySelectorAll('.position-cell')) {
    cell.addEventListener('click', () => {
      const val = cell.dataset.value;
      elements.overlayPosition.value = val;
      updatePositionGridActive(val);
      elements.overlayPosition.dispatchEvent(new Event('change'));
    });
  }

  let sizeRafPending = false;
  elements.overlaySize.addEventListener('input', () => {
    renderSize(elements.overlaySize.value);
    if (!sizeRafPending) {
      sizeRafPending = true;
      requestAnimationFrame(() => {
        window.livechat.previewSize(Number(elements.overlaySize.value));
        sizeRafPending = false;
      });
    }
  });
  elements.overlaySize.addEventListener('change', () => {
    sizeRafPending = false;
    saveSettings();
  });

  elements.volume.addEventListener('input', () => renderVolume(Number(elements.volume.value)));
  elements.volume.addEventListener('change', async () => {
    const volume = Number(elements.volume.value);
    await window.livechat.setVolume(volume);
    await saveSettings();
  });

  // Test formats
  function toggleTestFormat(format, btn) {
    const all = [elements.testLandscapeBtn, elements.testSquareBtn, elements.testPortraitBtn];
    if (state.activeTestFormat === format) {
      state.activeTestFormat = null;
      btn.classList.remove('active-test');
      window.livechat.triggerTestFormat('stop');
    } else {
      state.activeTestFormat = format;
      for (const b of all) b.classList.remove('active-test');
      btn.classList.add('active-test');
      window.livechat.triggerTestFormat(format);
    }
  }

  elements.testLandscapeBtn.addEventListener('click', () => toggleTestFormat('landscape', elements.testLandscapeBtn));
  elements.testSquareBtn.addEventListener('click',    () => toggleTestFormat('square',    elements.testSquareBtn));
  elements.testPortraitBtn.addEventListener('click',  () => toggleTestFormat('portrait',  elements.testPortraitBtn));
  elements.testSoundBtn.addEventListener('click', async () => { await window.livechat.testSound(); });

  // OBS URL copy
  if (elements.obsUrlCopyBtn && elements.obsUrlDisplay) {
    elements.obsUrlCopyBtn.addEventListener('click', async () => {
      const url = elements.obsUrlDisplay.value;
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        elements.obsUrlCopyBtn.textContent = '✓ Copié';
        setTimeout(() => { elements.obsUrlCopyBtn.textContent = 'Copier'; }, 2000);
      } catch {
        elements.obsUrlCopyBtn.textContent = 'Erreur';
        setTimeout(() => { elements.obsUrlCopyBtn.textContent = 'Copier'; }, 2000);
      }
    });
  }
}

// ── Update modal ───────────────────────────────────────────────────────────────

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? div.innerText ?? '').trim();
}

function showUpdateModal(version, releaseNotes) {
  const modal      = document.getElementById('updateModal');
  const title      = document.getElementById('updateModalTitle');
  const notes      = document.getElementById('updateModalNotes');
  const closeBtn   = document.getElementById('updateModalClose');
  const installBtn = document.getElementById('updateModalInstall');

  if (!modal || !title || !notes || !closeBtn || !installBtn) return;

  title.textContent = `v${version}`;
  notes.textContent = releaseNotes ? stripHtml(releaseNotes) : '';
  modal.classList.remove('hidden');

  const dismiss = () => modal.classList.add('hidden');
  closeBtn.addEventListener('click', dismiss, { once: true });
  installBtn.addEventListener('click', () => { dismiss(); window.livechat.installUpdate(); }, { once: true });
  modal.addEventListener('click', e => { if (e.target === modal) dismiss(); }, { once: true });
}

// ── IPC listeners ──────────────────────────────────────────────────────────────

window.livechat.onUpdateDownloaded(info => showUpdateModal(info.version, info.releaseNotes ?? ''));
window.livechat.onStatus(status => renderStatus(status));
window.livechat.onObsUrlChanged(url => setObsUrl(url));

window.livechat.onSettingsChanged(settings => {
  state.settings = settings;
  elements.backendUrl.value        = settings.backendUrl;
  elements.guildId.value           = settings.guildId;
  elements.clientToken.value       = settings.clientToken;
  elements.autoConnect.checked     = settings.autoConnect;
  elements.launchAtStartup.checked = settings.launchAtStartup;
  elements.startMinimized.checked  = settings.startMinimized;
  elements.screenId.value          = String(settings.screenId);
  elements.volume.value            = String(settings.volume);
  elements.overlaySize.value       = String(settings.overlaySize);
  elements.overlayPosition.value   = settings.overlayPosition;
  if (elements.localServerPort) elements.localServerPort.value = String(settings.localServerPort ?? 3001);
  updatePositionGridActive(settings.overlayPosition || 'center');
  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
});

// ── Bootstrap ──────────────────────────────────────────────────────────────────

bindEvents();
setupPresenceListeners();

refreshUi().then(async () => {
  renderStatus({ type: 'idle', message: 'Prêt' });
  if (state.settings?.backendUrl) {
    switchTab('settings');
  } else {
    switchTab('status');
    loadChangelog();
  }
  if (state.settings?.autoConnect && state.settings?.guildId) {
    renderStatus({ type: 'loading', message: 'Connexion automatique...' });
    const status = await window.livechat.connect();
    renderStatus(status);
  }
}).catch(error => {
  renderStatus({ type: 'error', message: error instanceof Error ? error.message : 'Erreur de chargement' });
});
