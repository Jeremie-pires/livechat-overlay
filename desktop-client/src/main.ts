import { app, BrowserWindow, ipcMain, Menu, nativeImage, safeStorage, screen, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs/promises';
import path from 'path';

type OverlayStatusType = 'idle' | 'loading' | 'connected' | 'error';

type AppSettings = {
  backendUrl: string;
  guildId: string;
  screenId: number;
  volume: number;
  autoConnect: boolean;
  clickThrough: boolean;
  overlaySize: number;
  overlayPosition: string;
  launchAtStartup: boolean;
  startMinimized: boolean;
  clientToken: string;
};

type DisplayInfo = {
  id: number;
  label: string;
  primary: boolean;
  bounds: Electron.Rectangle;
  workArea: Electron.Rectangle;
};

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  guildId: '',
  screenId: 0,
  volume: 100,
  autoConnect: true,
  clickThrough: true,
  overlaySize: 960,
  overlayPosition: 'center',
  launchAtStartup: false,
  startMinimized: false,
  clientToken: '',
};

const OVERLAY_POSITION_ALLOWLIST: readonly string[] = [
  'center',
  'top-left', 'top-center', 'top-right',
  'center-left', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

let controlWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let statusType: OverlayStatusType = 'idle';
let statusMessage = 'Prêt';
let settings = { ...DEFAULT_SETTINGS };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSettings(candidate: Partial<AppSettings> | undefined): AppSettings {
  const rawPosition = candidate?.overlayPosition?.trim() ?? '';
  return {
    backendUrl: candidate?.backendUrl?.trim() || DEFAULT_SETTINGS.backendUrl,
    guildId: candidate?.guildId?.trim() || '',
    screenId: Number.isFinite(candidate?.screenId as number) ? Number(candidate?.screenId) : DEFAULT_SETTINGS.screenId,
    volume: clampVolume(Number(candidate?.volume ?? DEFAULT_SETTINGS.volume)),
    autoConnect: Boolean(candidate?.autoConnect ?? DEFAULT_SETTINGS.autoConnect),
    clickThrough: true, // Always true to prevent desktop locks
    overlaySize: Number.isFinite(candidate?.overlaySize as number) ? Number(candidate?.overlaySize) : DEFAULT_SETTINGS.overlaySize,
    overlayPosition: OVERLAY_POSITION_ALLOWLIST.includes(rawPosition) ? rawPosition : DEFAULT_SETTINGS.overlayPosition,
    launchAtStartup: Boolean(candidate?.launchAtStartup ?? DEFAULT_SETTINGS.launchAtStartup),
    startMinimized: Boolean(candidate?.startMinimized ?? DEFAULT_SETTINGS.startMinimized),
    clientToken: candidate?.clientToken?.trim() || '',
  };
}

function applyLoginItemSettings(): void {
  app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup });
}

const ENCRYPTED_PREFIX = 'enc1:';

function encryptToken(plainText: string): string {
  if (!plainText) return '';
  if (!safeStorage.isEncryptionAvailable()) return plainText;
  try {
    return ENCRYPTED_PREFIX + safeStorage.encryptString(plainText).toString('base64');
  } catch {
    return plainText;
  }
}

function decryptToken(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    const buf = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return '';
  }
}

function getDisplayList(): DisplayInfo[] {
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Écran ${display.id}`,
    primary: display.id === screen.getPrimaryDisplay().id,
    bounds: display.bounds,
    workArea: display.workArea,
  }));
}

function getSelectedDisplay() {
  const displays = screen.getAllDisplays();
  const selectedDisplay = displays.find((display) => display.id === settings.screenId);

  if (selectedDisplay) {
    return selectedDisplay;
  }

  return screen.getPrimaryDisplay();
}

function getOverlayUrl() {
  const backendUrl = settings.backendUrl.replace(/\/$/, '');
  const guildId = encodeURIComponent(settings.guildId);
  const size = settings.overlaySize;
  const position = encodeURIComponent(settings.overlayPosition);
  const tokenParam = settings.clientToken ? `&token=${encodeURIComponent(settings.clientToken)}` : '';
  return `${backendUrl}/client?guildId=${guildId}&client=desktop&size=${size}&position=${position}${tokenParam}`;
}

function updateStatus(type: OverlayStatusType, message: string) {
  statusType = type;
  statusMessage = message;
  controlWindow?.webContents.send('overlay:status', { type, message });
}

async function loadSettingsFromDisk() {
  try {
    const content = await fs.readFile(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(content) as Partial<AppSettings>;
    if (parsed.clientToken) {
      parsed.clientToken = decryptToken(parsed.clientToken);
    }
    settings = normalizeSettings(parsed);
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettingsToDisk() {
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  const toWrite = { ...settings, clientToken: encryptToken(settings.clientToken) };
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(toWrite, null, 2)}\n`, 'utf-8');
}

function applyOverlayPlacement() {
  if (!overlayWindow) {
    return;
  }

  const display = getSelectedDisplay();
  overlayWindow.setBounds(display.bounds, false);
  overlayWindow.setIgnoreMouseEvents(true); // Always ignore mouse events to ensure click-through
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

async function applyMediaVolume() {
  if (!overlayWindow) {
    return;
  }

  const vol = settings.volume / 100;
  const script = `
    if (typeof window.__setVolume === 'function') {
      window.__setVolume(${vol});
    } else {
      document.querySelectorAll('audio,video').forEach(el => {
        el.volume = ${vol};
        el.muted = ${vol === 0};
      });
    }
  `;

  await overlayWindow.webContents.executeJavaScript(script, true).catch(() => undefined);
}

function getTrayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
}

function showControlWindow() {
  if (!controlWindow) return;
  if (controlWindow.isMinimized()) controlWindow.restore();
  controlWindow.show();
  controlWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(getTrayIconPath());
  tray = new Tray(icon);
  tray.setToolTip('LiveChatCCB Desktop');

  tray.on('click', () => {
    if (!controlWindow) return;
    if (controlWindow.isVisible()) {
      controlWindow.hide();
    } else {
      showControlWindow();
    }
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ouvrir', click: () => showControlWindow() },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 380,
    minHeight: 600,
    title: 'LiveChatCCB Desktop',
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  controlWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  controlWindow.once('ready-to-show', () => {
    if (!settings.startMinimized) {
      controlWindow?.show();
    }
  });

  // Hide to tray on close instead of quitting
  controlWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      controlWindow?.hide();
    }
  });

  controlWindow.on('closed', () => {
    controlWindow = null;
    destroyOverlayWindow();
  });
}

function destroyOverlayWindow() {
  if (!overlayWindow) {
    return;
  }

  overlayWindow.destroy();
  overlayWindow = null;
}

function createOverlayWindow() {
  const display = getSelectedDisplay();

  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    focusable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    title: 'LiveChat overlay',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlayWindow.webContents.on('did-finish-load', async () => {
    if (overlayWindow) {
      await overlayWindow.webContents.insertCSS(`
        #disappear, #empty-state {
          display: none !important;
        }
      `).catch(() => undefined);
    }
    await applyMediaVolume();
    overlayWindow?.showInactive();
    updateStatus('connected', `Connecté à ${settings.guildId}`);
  });

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) {
      return;
    }

    updateStatus('error', `Impossible de charger l'overlay (${errorCode}) ${errorDescription}`);
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  applyOverlayPlacement();
}

async function connectOverlay() {
  if (!settings.guildId) {
    updateStatus('error', "Renseigne l'ID du serveur Discord pour connecter la salle.");
    return;
  }

  if (statusType === 'loading' || statusType === 'connected') {
    return;
  }

  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (!overlayWindow) {
    updateStatus('error', 'Impossible de créer la fenêtre overlay.');
    return;
  }

  applyOverlayPlacement();
  updateStatus('loading', `Connexion à ${settings.backendUrl}`);
  overlayWindow.showInactive();
  try {
    await overlayWindow.loadURL(getOverlayUrl());
  } catch (err: any) {
    // Only report error if we didn't transition to connected/idle in the meantime
    if ((statusType as string) === 'loading') {
      console.error('Failed to load overlay URL:', err);
      updateStatus('error', `Erreur de chargement: ${err.message || err}`);
    }
  }
}

function registerIpc() {
  ipcMain.handle('app:get-settings', async () => settings);

  ipcMain.handle('app:get-displays', async () => getDisplayList());

  ipcMain.handle('app:save-settings', async (_event, nextSettings: Partial<AppSettings>) => {
    settings = normalizeSettings(nextSettings);
    await saveSettingsToDisk();
    applyLoginItemSettings();
    applyOverlayPlacement();
    if (overlayWindow) {
      if (settings.volume >= 0) {
        await applyMediaVolume();
      }
      const js = `if (typeof window.__updateLayoutSettings === 'function') { window.__updateLayoutSettings(${settings.overlaySize}, '${settings.overlayPosition}'); }`;
      overlayWindow.webContents.executeJavaScript(js).catch(() => undefined);
    }
    controlWindow?.webContents.send('overlay:settings-changed', settings);
    return settings;
  });

  ipcMain.handle('app:test-connection', async (_event, { backendUrl, guildId }) => {
    try {
      const url = `${backendUrl.replace(/\/$/, '')}/client?guildId=${encodeURIComponent(guildId)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response.ok;
    } catch {
      return false;
    }
  });

  ipcMain.handle('overlay:trigger-test-format', async (_event, format: string) => {
    if (overlayWindow) {
      const js = `if (typeof window.__triggerTestFormat === 'function') { window.__triggerTestFormat('${format}'); }`;
      await overlayWindow.webContents.executeJavaScript(js).catch(() => undefined);
      return true;
    }
    return false;
  });

  ipcMain.handle('overlay:connect', async () => {
    await connectOverlay();
    return { type: statusType, message: statusMessage };
  });

  ipcMain.handle('overlay:disconnect', async () => {
    destroyOverlayWindow();
    updateStatus('idle', 'Fenêtre overlay fermée');
    return { type: statusType, message: statusMessage };
  });

  ipcMain.handle('overlay:set-volume', async (_event, nextVolume: number) => {
    settings.volume = clampVolume(nextVolume);
    await saveSettingsToDisk();
    await applyMediaVolume();
    controlWindow?.webContents.send('overlay:settings-changed', settings);
    return settings.volume;
  });

  ipcMain.handle('overlay:refresh-placement', async () => {
    applyOverlayPlacement();
    return true;
  });

  ipcMain.handle('app:get-presence', async () => {
    if (!settings.clientToken || !settings.guildId) return [];
    try {
      const base = settings.backendUrl.replace(/\/$/, '');
      const url = `${base}/api/presence/${encodeURIComponent(settings.guildId)}?token=${encodeURIComponent(settings.clientToken)}`;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) return [];
      return (await res.json()) as Array<{ displayName: string; connectedAt: number; avatarUrl: string | null }>;
    } catch {
      return [];
    }
  });

  // Forward real-time presence events from the overlay window to the control window
  ipcMain.on('presence:update', (_event, data: unknown) => {
    controlWindow?.webContents.send('presence:update', data);
  });

  ipcMain.on('presence:userJoined', (_event, data: unknown) => {
    controlWindow?.webContents.send('presence:userJoined', data);
  });

  ipcMain.on('presence:userLeft', (_event, data: unknown) => {
    controlWindow?.webContents.send('presence:userLeft', data);
  });

  ipcMain.handle('overlay:test-sound', async () => {
    if (!overlayWindow) return false;
    const vol = settings.volume / 100;
    const script = `
      (() => {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(${vol} * 0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        } catch(e) { console.warn('Test sound failed:', e); }
      })();
    `;
    await overlayWindow.webContents.executeJavaScript(script, true).catch(() => undefined);
    return true;
  });
}

type ReleaseNote = { version: string; note: string | null };

function normalizeReleaseNotes(notes: string | ReleaseNote[] | null | undefined): string {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  return notes.map((n) => `v${n.version}\n${n.note ?? ''}`).join('\n\n');
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    const releaseNotes = normalizeReleaseNotes(info.releaseNotes as string | ReleaseNote[] | null);
    controlWindow?.webContents.send('update:downloaded', { version: info.version, releaseNotes });
  });

  autoUpdater.on('error', () => {
    // Silent — update check failures shouldn't interrupt the user
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 5000);
}

async function bootstrap() {
  await loadSettingsFromDisk();
  applyLoginItemSettings();
  registerIpc();
  createControlWindow();
  createTray();
  updateStatus('idle', statusMessage);

  if (app.isPackaged) {
    setupAutoUpdater();
  }

  if (settings.autoConnect) {
    await connectOverlay();
  }
}

app.on('before-quit', () => {
  isQuitting = true;
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!controlWindow) {
      createControlWindow();
    }
    showControlWindow();
  });

  app.whenReady().then(() => {
    void bootstrap();

    app.on('activate', () => {
      if (controlWindow) {
        showControlWindow();
      } else {
        createControlWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  // Do not quit — tray keeps the app alive
});
