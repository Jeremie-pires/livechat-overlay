const state = {
  settings: null,
  displays: [],
  status: {
    type: 'idle',
    message: 'Prêt',
  },
  activeTestFormat: null,
  clients: [],
};

const elements = {
  // Navigation Tabs
  btnTabControl: document.getElementById('btnTabControl'),
  btnTabConfig: document.getElementById('btnTabConfig'),
  btnTabUsers: document.getElementById('btnTabUsers'),
  contentControl: document.getElementById('contentControl'),
  contentConfig: document.getElementById('contentConfig'),
  contentUsers: document.getElementById('contentUsers'),

  // Control Tab Fields
  toggleOverlayBtn: document.getElementById('toggleOverlayBtn'),
  overlayPosition: document.getElementById('overlayPosition'),
  screenId: document.getElementById('screenId'),
  overlaySize: document.getElementById('overlaySize'),
  sizeValue: document.getElementById('sizeValue'),
  volume: document.getElementById('volume'),
  volumeValue: document.getElementById('volumeValue'),

  // Format Test Buttons
  testLandscapeBtn: document.getElementById('testLandscapeBtn'),
  testSquareBtn: document.getElementById('testSquareBtn'),
  testPortraitBtn: document.getElementById('testPortraitBtn'),
  testSoundBtn: document.getElementById('testSoundBtn'),

  // Config Tab Fields
  backendUrl: document.getElementById('backendUrl'),
  guildId: document.getElementById('guildId'),
  clientToken: document.getElementById('clientToken'),
  autoConnect: document.getElementById('autoConnect'),
  launchAtStartup: document.getElementById('launchAtStartup'),
  startMinimized: document.getElementById('startMinimized'),
  testConnBtn: document.getElementById('testConnBtn'),

  // Presence
  presenceSummary: document.getElementById('presenceSummary'),
  userList: document.getElementById('userList'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  testResultBox: document.getElementById('testResultBox'),
  testResultIcon: document.getElementById('testResultIcon'),
  testResultText: document.getElementById('testResultText'),

  // Summary Metrics
  statusSummary: document.getElementById('statusSummary'),
  windowSummary: document.getElementById('windowSummary'),
  screenSummary: document.getElementById('screenSummary'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
};

const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Toggle viewable tabs
function switchTab(activeTab) {
  const tabs = ['control', 'config', 'users'];
  const btns = [elements.btnTabControl, elements.btnTabConfig, elements.btnTabUsers];
  const panels = [elements.contentControl, elements.contentConfig, elements.contentUsers];

  tabs.forEach((tab, i) => {
    const isActive = tab === activeTab;
    btns[i].classList.toggle('active', isActive);
    panels[i].classList.toggle('hidden', !isActive);
  });
}

function renderStatus(status) {
  state.status = status;
  elements.statusText.textContent = status.message;
  elements.statusSummary.textContent = status.message;
  elements.statusDot.dataset.status = status.type;

  if (status.type === 'connected') {
    startPresencePolling();
  } else {
    stopPresencePolling();
  }

  // Render main toggle button
  if (status.type === 'connected') {
    elements.toggleOverlayBtn.textContent = "Désactiver l'overlay";
    elements.toggleOverlayBtn.className = "primary-toggle btn-active";
    elements.toggleOverlayBtn.disabled = false;
    elements.windowSummary.textContent = 'Visible';

    // Enable format tests
    elements.testLandscapeBtn.disabled = false;
    elements.testSquareBtn.disabled = false;
    elements.testPortraitBtn.disabled = false;
    elements.testSoundBtn.disabled = false;
  } else {
    // Clear mock test button highlights if disconnected or loading
    state.activeTestFormat = null;
    elements.testLandscapeBtn.classList.remove('active-test');
    elements.testSquareBtn.classList.remove('active-test');
    elements.testPortraitBtn.classList.remove('active-test');

    if (status.type === 'loading') {
      elements.toggleOverlayBtn.textContent = "Connexion en cours...";
      elements.toggleOverlayBtn.className = "primary-toggle btn-inactive";
      elements.toggleOverlayBtn.disabled = true;
      elements.windowSummary.textContent = 'Chargement';

      // Disable format tests
      elements.testLandscapeBtn.disabled = true;
      elements.testSquareBtn.disabled = true;
      elements.testPortraitBtn.disabled = true;
      elements.testSoundBtn.disabled = true;
    } else {
      elements.toggleOverlayBtn.textContent = "Activer l'overlay";
      elements.toggleOverlayBtn.className = "primary-toggle btn-inactive";
      elements.toggleOverlayBtn.disabled = false;
      elements.windowSummary.textContent = 'Inactive';

      // Disable format tests
      elements.testLandscapeBtn.disabled = true;
      elements.testSquareBtn.disabled = true;
      elements.testPortraitBtn.disabled = true;
      elements.testSoundBtn.disabled = true;
    }
  }
}

function renderScreenSummary() {
  const selectedScreen = state.displays.find((display) => String(display.id) === String(elements.screenId.value));
  elements.screenSummary.textContent = selectedScreen ? selectedScreen.label : 'Écran principal';
}

function renderVolume(value) {
  elements.volumeValue.textContent = `${value}%`;
}

function renderSize(value) {
  elements.sizeValue.textContent = `${value}px`;
}

function populateDisplays(displays) {
  state.displays = displays;
  elements.screenId.innerHTML = '';

  for (const display of displays) {
    const option = document.createElement('option');
    option.value = String(display.id);
    option.textContent = display.primary ? `${display.label} (principal)` : display.label;
    elements.screenId.appendChild(option);
  }

  renderScreenSummary();
}

function readFormValues() {
  return {
    backendUrl: elements.backendUrl.value.trim(),
    guildId: elements.guildId.value.trim(),
    clientToken: elements.clientToken.value.trim(),
    screenId: Number(elements.screenId.value),
    volume: Number(elements.volume.value),
    overlaySize: Number(elements.overlaySize.value),
    overlayPosition: elements.overlayPosition.value,
    autoConnect: elements.autoConnect.checked,
    launchAtStartup: elements.launchAtStartup.checked,
    startMinimized: elements.startMinimized.checked,
    clickThrough: true, // Click-through is now forced to true for user convenience
  };
}

async function saveSettings() {
  const settings = await window.livechat.saveSettings(readFormValues());
  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
  return settings;
}

async function toggleOverlay() {
  if (state.status.type === 'connected') {
    // Disconnect
    renderStatus({ type: 'loading', message: 'Fermeture...' });
    const status = await window.livechat.disconnect();
    renderStatus(status);
  } else {
    // Connect
    if (!elements.guildId.value.trim()) {
      switchTab('config');
      showTestResult('error', "Renseigne l'ID de ton serveur Discord pour te connecter.");
      return;
    }
    renderStatus({ type: 'loading', message: 'Connexion...' });
    await saveSettings();
    const status = await window.livechat.connect();
    renderStatus(status);
  }
}

let testResultTimeout = null;

function showTestResult(type, message) {
  if (testResultTimeout) {
    clearTimeout(testResultTimeout);
    testResultTimeout = null;
  }

  elements.testResultBox.className = `test-result-box ${type}`;
  elements.testResultBox.classList.remove('hidden');
  elements.testResultText.textContent = message;

  const icon = elements.testResultIcon;
  if (icon) {
    if (type === 'success') {
      icon.textContent = '✓';
    } else if (type === 'error') {
      icon.textContent = '✗';
    } else {
      icon.textContent = '⏳';
    }
  }

  // Hide the alert box after 5 seconds if connection test finished (success or error)
  if (type === 'success' || type === 'error') {
    testResultTimeout = setTimeout(() => {
      elements.testResultBox.classList.add('hidden');
    }, 5000);
  }
}

async function testConnection() {
  const backendUrl = elements.backendUrl.value.trim();
  const guildId = elements.guildId.value.trim();

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
      showTestResult('error', 'Impossible de se connecter au serveur. Vérifie les valeurs renseignées.');
    }
  } catch (err) {
    showTestResult('error', `Erreur technique : ${err.message}`);
  } finally {
    elements.testConnBtn.disabled = false;
  }
}

function updatePositionGridActive(positionValue) {
  const cells = document.querySelectorAll('.position-cell');
  for (const cell of cells) {
    if (cell.dataset.value === positionValue) {
      cell.classList.add('active');
    } else {
      cell.classList.remove('active');
    }
  }
}

async function refreshUi() {
  const [settings, displays] = await Promise.all([
    window.livechat.getSettings(),
    window.livechat.getDisplays(),
  ]);

  state.settings = settings;
  populateDisplays(displays);

  // Load config values
  elements.backendUrl.value = settings.backendUrl;
  elements.guildId.value = settings.guildId;
  elements.clientToken.value = settings.clientToken;
  elements.autoConnect.checked = settings.autoConnect;
  elements.launchAtStartup.checked = settings.launchAtStartup;
  elements.startMinimized.checked = settings.startMinimized;

  // Load control values
  elements.screenId.value = String(settings.screenId || displays.find((display) => display.primary)?.id || displays[0]?.id || 0);
  elements.volume.value = String(settings.volume);
  elements.overlaySize.value = String(settings.overlaySize || 960);
  elements.overlayPosition.value = settings.overlayPosition || 'center';
  updatePositionGridActive(settings.overlayPosition || 'center');

  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
}

let presenceInterval = null;
let presenceCleanup = null;
let presenceUserJoinedCleanup = null;
let presenceUserLeftCleanup = null;

function updatePresenceSummary(clients) {
  if (!elements.presenceSummary) return;
  const count = clients.length;
  elements.presenceSummary.textContent = count === 0 ? '—' : String(count);
  elements.presenceSummary.title = clients.map((c) => c.displayName).join(', ');
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
  name.textContent = client.displayName; // textContent is XSS-safe
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
  if (!elements.userList) return;
  if (!client.id) return;
  // Idempotence: no duplicate inserts
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
  if (!item) return; // Idempotence: no-op if already absent

  const onRemoved = () => {
    item.remove();
    if (elements.userList && !elements.userList.querySelector('.user-item')) {
      showEmptyPlaceholder();
    }
  };

  if (noMotion) {
    onRemoved();
    return;
  }

  const height = item.getBoundingClientRect().height;
  item.style.overflow = 'hidden';
  item.style.maxHeight = `${height}px`;

  // Force reflow so the browser registers the initial maxHeight before transitioning
  void item.offsetHeight;

  item.style.transition = 'opacity 160ms ease-in, max-height 160ms ease-in, padding 160ms ease-in, margin 160ms ease-in';
  item.style.opacity = '0';
  item.style.maxHeight = '0';
  item.style.paddingTop = '0';
  item.style.paddingBottom = '0';
  item.style.marginBottom = '0';

  item.addEventListener('transitionend', onRemoved, { once: true });
}

function reconcileUserList(snapshot) {
  if (!elements.userList) return;

  const validSnapshot = snapshot.filter((c) => c.id);
  const snapshotMap = new Map(validSnapshot.map((c) => [c.id, c]));

  // Remove DOM items no longer in snapshot
  const existingItems = elements.userList.querySelectorAll('.user-item[data-user-id]');
  for (const domItem of existingItems) {
    const userId = domItem.getAttribute('data-user-id');
    if (!snapshotMap.has(userId)) {
      domItem.remove();
    }
  }

  // Insert items present in snapshot but not yet in DOM
  for (const client of validSnapshot) {
    if (!elements.userList.querySelector(`[data-user-id="${client.id}"]`)) {
      const empty = elements.userList.querySelector('.user-list-empty');
      if (empty) empty.remove();
      const item = buildUserItem(client);
      if (item) elements.userList.appendChild(item);
    }
  }

  // Show placeholder when list is empty
  if (validSnapshot.length === 0 && !elements.userList.querySelector('.user-item')) {
    showEmptyPlaceholder();
  }
}

function updatePresence(clients) {
  state.clients = clients;
  updatePresenceSummary(clients);
  reconcileUserList(clients);
}

function startPresencePolling() {
  if (presenceInterval) return;
  window.livechat.getPresence().then(updatePresence);
  // Fallback polling every 60s in case the real-time IPC bridge is unavailable
  presenceInterval = setInterval(async () => {
    const clients = await window.livechat.getPresence();
    updatePresence(clients);
  }, 60000);
}

function stopPresencePolling() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  if (elements.presenceSummary) {
    elements.presenceSummary.textContent = '—';
    elements.presenceSummary.title = '';
  }
  state.clients = [];
  reconcileUserList([]);
}

function setupPresenceListeners() {
  if (presenceCleanup) return;

  presenceCleanup = window.livechat.onPresence((snapshot) => {
    updatePresence(snapshot);
  });

  presenceUserJoinedCleanup = window.livechat.onUserJoined((data) => {
    // Idempotent: addUserToList is a no-op if user already present
    const client = {
      id: data.id,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      connectedAt: data.connectedAt,
    };
    state.clients = [...state.clients.filter((c) => c.id !== data.id), client];
    addUserToList(client);
    updatePresenceSummary(state.clients);
  });

  presenceUserLeftCleanup = window.livechat.onUserLeft((data) => {
    state.clients = state.clients.filter((c) => c.id !== data.id);
    removeUserFromList(data.id);
    updatePresenceSummary(state.clients);
  });
}

function bindEvents() {
  // Tabs Navigation
  elements.btnTabControl.addEventListener('click', () => switchTab('control'));
  elements.btnTabConfig.addEventListener('click', () => switchTab('config'));
  elements.btnTabUsers.addEventListener('click', () => switchTab('users'));

  // Activation Toggle
  elements.toggleOverlayBtn.addEventListener('click', toggleOverlay);

  // Configuration actions
  elements.testConnBtn.addEventListener('click', testConnection);
  elements.saveConfigBtn.addEventListener('click', async () => {
    await saveSettings();
    showTestResult('success', 'Configuration enregistrée !');
    setTimeout(() => {
      elements.testResultBox.classList.add('hidden');
      switchTab('control');
    }, 1200);
  });

  // Control events (real-time updates)
  elements.screenId.addEventListener('change', async () => {
    await saveSettings();
    await window.livechat.refreshPlacement();
  });

  elements.overlayPosition.addEventListener('change', saveSettings);

  // Grid cells click binding
  const positionCells = document.querySelectorAll('.position-cell');
  for (const cell of positionCells) {
    cell.addEventListener('click', () => {
      const val = cell.dataset.value;
      elements.overlayPosition.value = val;
      updatePositionGridActive(val);
      elements.overlayPosition.dispatchEvent(new Event('change'));
    });
  }

  elements.overlaySize.addEventListener('input', () => {
    renderSize(elements.overlaySize.value);
  });
  elements.overlaySize.addEventListener('change', saveSettings);

  elements.volume.addEventListener('input', () => {
    renderVolume(Number(elements.volume.value));
  });
  elements.volume.addEventListener('change', async () => {
    const volume = Number(elements.volume.value);
    await window.livechat.setVolume(volume);
    await saveSettings();
  });

  // Click-through is now permanent, event listener removed

  function toggleTestFormat(format, btn) {
    const testButtons = [elements.testLandscapeBtn, elements.testSquareBtn, elements.testPortraitBtn];

    if (state.activeTestFormat === format) {
      state.activeTestFormat = null;
      btn.classList.remove('active-test');
      window.livechat.triggerTestFormat('stop');
    } else {
      state.activeTestFormat = format;
      for (const b of testButtons) {
        b.classList.remove('active-test');
      }
      btn.classList.add('active-test');
      window.livechat.triggerTestFormat(format);
    }
  }

  // Mock Format Test buttons
  elements.testLandscapeBtn.addEventListener('click', () => {
    toggleTestFormat('landscape', elements.testLandscapeBtn);
  });
  elements.testSquareBtn.addEventListener('click', () => {
    toggleTestFormat('square', elements.testSquareBtn);
  });
  elements.testPortraitBtn.addEventListener('click', () => {
    toggleTestFormat('portrait', elements.testPortraitBtn);
  });

  elements.testSoundBtn.addEventListener('click', async () => {
    await window.livechat.testSound();
  });
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? div.innerText ?? '').trim();
}

function showUpdateModal(version, releaseNotes) {
  const modal = document.getElementById('updateModal');
  const title = document.getElementById('updateModalTitle');
  const notes = document.getElementById('updateModalNotes');
  const closeBtn = document.getElementById('updateModalClose');
  const installBtn = document.getElementById('updateModalInstall');

  if (!modal || !title || !notes || !closeBtn || !installBtn) return;

  title.textContent = `v${version}`;
  notes.textContent = releaseNotes ? stripHtml(releaseNotes) : '';
  modal.classList.remove('hidden');

  const dismiss = () => modal.classList.add('hidden');
  closeBtn.addEventListener('click', dismiss, { once: true });
  installBtn.addEventListener('click', () => {
    dismiss();
    window.livechat.installUpdate();
  }, { once: true });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) dismiss();
  }, { once: true });
}

window.livechat.onUpdateDownloaded((info) => {
  showUpdateModal(info.version, info.releaseNotes ?? '');
});

window.livechat.onStatus((status) => {
  renderStatus(status);
});

window.livechat.onSettingsChanged((settings) => {
  state.settings = settings;
  elements.backendUrl.value = settings.backendUrl;
  elements.guildId.value = settings.guildId;
  elements.clientToken.value = settings.clientToken;
  elements.autoConnect.checked = settings.autoConnect;
  elements.launchAtStartup.checked = settings.launchAtStartup;
  elements.startMinimized.checked = settings.startMinimized;
  elements.screenId.value = String(settings.screenId);
  elements.volume.value = String(settings.volume);
  elements.overlaySize.value = String(settings.overlaySize);
  elements.overlayPosition.value = settings.overlayPosition;
  updatePositionGridActive(settings.overlayPosition || 'center');
  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
});

bindEvents();

// Subscribe to real-time presence and delta events from the overlay socket bridge
setupPresenceListeners();

refreshUi().then(async () => {
  renderStatus({ type: 'idle', message: 'Prêt' });
  if (state.settings?.autoConnect && state.settings?.guildId) {
    // If autoConnect is enabled, immediately connect
    renderStatus({ type: 'loading', message: 'Connexion automatique...' });
    const status = await window.livechat.connect();
    renderStatus(status);
  }
}).catch((error) => {
  renderStatus({ type: 'error', message: error instanceof Error ? error.message : 'Erreur de chargement' });
});
