const state = {
  settings: null,
  displays: [],
  status: {
    type: 'idle',
    message: 'Prêt',
  },
};

const elements = {
  backendUrl: document.getElementById('backendUrl'),
  guildId: document.getElementById('guildId'),
  screenId: document.getElementById('screenId'),
  volume: document.getElementById('volume'),
  volumeValue: document.getElementById('volumeValue'),
  autoConnect: document.getElementById('autoConnect'),
  clickThrough: document.getElementById('clickThrough'),
  saveButton: document.getElementById('saveButton'),
  connectButton: document.getElementById('connectButton'),
  disconnectButton: document.getElementById('disconnectButton'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusSummary: document.getElementById('statusSummary'),
  windowSummary: document.getElementById('windowSummary'),
  screenSummary: document.getElementById('screenSummary'),
};

function renderStatus(status) {
  state.status = status;
  elements.statusText.textContent = status.message;
  elements.statusSummary.textContent = status.message;
  elements.statusDot.dataset.status = status.type;
}

function renderScreenSummary() {
  const selectedScreen = state.displays.find((display) => String(display.id) === String(elements.screenId.value));
  elements.screenSummary.textContent = selectedScreen ? selectedScreen.label : 'Écran principal';
}

function renderVolume(value) {
  elements.volumeValue.textContent = `${value}%`;
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
    autoConnect: elements.autoConnect.checked,
    clickThrough: elements.clickThrough.checked,
  };
}

async function saveSettings() {
  const settings = await window.livechat.saveSettings(readFormValues());
  renderVolume(settings.volume);
  renderScreenSummary();
  return settings;
}

async function connectOverlay() {
  await saveSettings();
  const status = await window.livechat.connect();
  renderStatus(status);
  elements.windowSummary.textContent = status.type === 'connected' ? 'Visible' : 'Inactive';
}

async function disconnectOverlay() {
  const status = await window.livechat.disconnect();
  renderStatus(status);
  elements.windowSummary.textContent = 'Inactive';
}

async function refreshUi() {
  const [settings, displays] = await Promise.all([
    window.livechat.getSettings(),
    window.livechat.getDisplays(),
  ]);

  state.settings = settings;
  populateDisplays(displays);

  elements.backendUrl.value = settings.backendUrl;
  elements.guildId.value = settings.guildId;
  elements.screenId.value = String(settings.screenId || displays.find((display) => display.primary)?.id || displays[0]?.id || 0);
  elements.volume.value = String(settings.volume);
  elements.autoConnect.checked = settings.autoConnect;
  elements.clickThrough.checked = settings.clickThrough;
  renderVolume(settings.volume);
  renderScreenSummary();
}

function bindEvents() {
  elements.saveButton.addEventListener('click', async () => {
    await saveSettings();
    renderStatus({ type: 'idle', message: 'Réglages enregistrés' });
  });

  elements.connectButton.addEventListener('click', async () => {
    await connectOverlay();
  });

  elements.disconnectButton.addEventListener('click', async () => {
    await disconnectOverlay();
  });

  elements.screenId.addEventListener('change', async () => {
    await saveSettings();
    await window.livechat.refreshPlacement();
  });

  elements.volume.addEventListener('input', async () => {
    renderVolume(Number(elements.volume.value));
  });

  elements.volume.addEventListener('change', async () => {
    const volume = Number(elements.volume.value);
    await window.livechat.setVolume(volume);
    await saveSettings();
  });

  elements.autoConnect.addEventListener('change', saveSettings);
  elements.clickThrough.addEventListener('change', async () => {
    await saveSettings();
    await window.livechat.refreshPlacement();
  });
}

window.livechat.onStatus((status) => {
  renderStatus(status);
  elements.windowSummary.textContent = status.type === 'connected' ? 'Visible' : 'Inactive';
});

window.livechat.onSettingsChanged((settings) => {
  state.settings = settings;
  elements.backendUrl.value = settings.backendUrl;
  elements.guildId.value = settings.guildId;
  elements.screenId.value = String(settings.screenId);
  elements.volume.value = String(settings.volume);
  elements.autoConnect.checked = settings.autoConnect;
  elements.clickThrough.checked = settings.clickThrough;
  renderVolume(settings.volume);
  renderScreenSummary();
});

bindEvents();

refreshUi().then(async () => {
  renderStatus({ type: 'idle', message: 'Prêt' });
  if (state.settings?.autoConnect && state.settings?.guildId) {
    await connectOverlay();
  }
}).catch((error) => {
  renderStatus({ type: 'error', message: error instanceof Error ? error.message : 'Erreur de chargement' });
});
