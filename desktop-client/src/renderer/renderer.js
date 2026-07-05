const state = {
  settings: null,
  displays: [],
  status: {
    type: 'idle',
    message: 'Prêt',
  },
};

const elements = {
  // Navigation Tabs
  btnTabControl: document.getElementById('btnTabControl'),
  btnTabConfig: document.getElementById('btnTabConfig'),
  contentControl: document.getElementById('contentControl'),
  contentConfig: document.getElementById('contentConfig'),

  // Control Tab Fields
  toggleOverlayBtn: document.getElementById('toggleOverlayBtn'),
  overlayPosition: document.getElementById('overlayPosition'),
  screenId: document.getElementById('screenId'),
  overlaySize: document.getElementById('overlaySize'),
  sizeValue: document.getElementById('sizeValue'),
  volume: document.getElementById('volume'),
  volumeValue: document.getElementById('volumeValue'),
  clickThrough: document.getElementById('clickThrough'),

  // Format Test Buttons
  testLandscapeBtn: document.getElementById('testLandscapeBtn'),
  testSquareBtn: document.getElementById('testSquareBtn'),
  testPortraitBtn: document.getElementById('testPortraitBtn'),

  // Config Tab Fields
  backendUrl: document.getElementById('backendUrl'),
  guildId: document.getElementById('guildId'),
  autoConnect: document.getElementById('autoConnect'),
  testConnBtn: document.getElementById('testConnBtn'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  testResultBox: document.getElementById('testResultBox'),
  testResultText: document.getElementById('testResultText'),

  // Summary Metrics
  statusSummary: document.getElementById('statusSummary'),
  windowSummary: document.getElementById('windowSummary'),
  screenSummary: document.getElementById('screenSummary'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
};

// Toggle viewable tabs
function switchTab(activeTab) {
  if (activeTab === 'control') {
    elements.btnTabControl.classList.add('active');
    elements.btnTabConfig.classList.remove('active');
    elements.contentControl.classList.remove('hidden');
    elements.contentConfig.classList.add('hidden');
  } else {
    elements.btnTabControl.classList.remove('active');
    elements.btnTabConfig.classList.add('active');
    elements.contentControl.classList.add('hidden');
    elements.contentConfig.classList.remove('hidden');
  }
}

function renderStatus(status) {
  state.status = status;
  elements.statusText.textContent = status.message;
  elements.statusSummary.textContent = status.message;
  elements.statusDot.dataset.status = status.type;

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
  } else if (status.type === 'loading') {
    elements.toggleOverlayBtn.textContent = "Connexion en cours...";
    elements.toggleOverlayBtn.className = "primary-toggle btn-inactive";
    elements.toggleOverlayBtn.disabled = true;
    elements.windowSummary.textContent = 'Chargement';

    // Disable format tests
    elements.testLandscapeBtn.disabled = true;
    elements.testSquareBtn.disabled = true;
    elements.testPortraitBtn.disabled = true;
  } else {
    elements.toggleOverlayBtn.textContent = "Activer l'overlay";
    elements.toggleOverlayBtn.className = "primary-toggle btn-inactive";
    elements.toggleOverlayBtn.disabled = false;
    elements.windowSummary.textContent = 'Inactive';

    // Disable format tests
    elements.testLandscapeBtn.disabled = true;
    elements.testSquareBtn.disabled = true;
    elements.testPortraitBtn.disabled = true;
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
    screenId: Number(elements.screenId.value),
    volume: Number(elements.volume.value),
    overlaySize: Number(elements.overlaySize.value),
    overlayPosition: elements.overlayPosition.value,
    autoConnect: elements.autoConnect.checked,
    clickThrough: elements.clickThrough.checked,
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

function showTestResult(type, message) {
  elements.testResultBox.className = `test-result-box ${type}`;
  elements.testResultBox.classList.remove('hidden');
  elements.testResultText.textContent = message;

  const icon = elements.testResultIcon;
  if (type === 'success') {
    icon.textContent = '✓';
  } else if (type === 'error') {
    icon.textContent = '✗';
  } else {
    icon.textContent = '⏳';
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
  elements.autoConnect.checked = settings.autoConnect;

  // Load control values
  elements.screenId.value = String(settings.screenId || displays.find((display) => display.primary)?.id || displays[0]?.id || 0);
  elements.volume.value = String(settings.volume);
  elements.overlaySize.value = String(settings.overlaySize || 960);
  elements.overlayPosition.value = settings.overlayPosition || 'center';
  elements.clickThrough.checked = settings.clickThrough;

  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
}

function bindEvents() {
  // Tabs Navigation
  elements.btnTabControl.addEventListener('click', () => switchTab('control'));
  elements.btnTabConfig.addEventListener('click', () => switchTab('config'));

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

  elements.clickThrough.addEventListener('change', async () => {
    await saveSettings();
    await window.livechat.refreshPlacement();
  });

  // Mock Format Test buttons
  elements.testLandscapeBtn.addEventListener('click', () => {
    window.livechat.triggerTestFormat('landscape');
  });
  elements.testSquareBtn.addEventListener('click', () => {
    window.livechat.triggerTestFormat('square');
  });
  elements.testPortraitBtn.addEventListener('click', () => {
    window.livechat.triggerTestFormat('portrait');
  });
}

window.livechat.onStatus((status) => {
  renderStatus(status);
});

window.livechat.onSettingsChanged((settings) => {
  state.settings = settings;
  elements.backendUrl.value = settings.backendUrl;
  elements.guildId.value = settings.guildId;
  elements.autoConnect.checked = settings.autoConnect;
  elements.screenId.value = String(settings.screenId);
  elements.volume.value = String(settings.volume);
  elements.overlaySize.value = String(settings.overlaySize);
  elements.overlayPosition.value = settings.overlayPosition;
  elements.clickThrough.checked = settings.clickThrough;
  renderVolume(settings.volume);
  renderSize(settings.overlaySize);
  renderScreenSummary();
});

bindEvents();

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
