import { contextBridge, ipcRenderer } from 'electron';

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
  localServerPort: number;
};

type PresenceEntry = { id: string; displayName: string; connectedAt: number; avatarUrl: string | null };

type UserJoinedPayload = { id: string; displayName: string; avatarUrl: string | null; connectedAt: number };

type OverlayStatus = {
  type: 'idle' | 'loading' | 'connected' | 'error';
  message: string;
};

contextBridge.exposeInMainWorld('livechat', {
  getSettings: () => ipcRenderer.invoke('app:get-settings') as Promise<AppSettings>,
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  getDisplays: () => ipcRenderer.invoke('app:get-displays') as Promise<Array<{ id: number; label: string; primary: boolean }>>,
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('app:save-settings', settings) as Promise<AppSettings>,
  connect: () => ipcRenderer.invoke('overlay:connect') as Promise<OverlayStatus>,
  disconnect: () => ipcRenderer.invoke('overlay:disconnect') as Promise<OverlayStatus>,
  setVolume: (volume: number) => ipcRenderer.invoke('overlay:set-volume', volume) as Promise<number>,
  setSize: (size: number) => ipcRenderer.invoke('overlay:set-size', size) as Promise<number>,
  previewSize: (size: number) => ipcRenderer.invoke('overlay:preview-size', size) as Promise<number>,
  refreshPlacement: () => ipcRenderer.invoke('overlay:refresh-placement') as Promise<boolean>,
  testConnection: (backendUrl: string, guildId: string) => ipcRenderer.invoke('app:test-connection', { backendUrl, guildId }) as Promise<boolean>,
  triggerTestFormat: (format: string) => ipcRenderer.invoke('overlay:trigger-test-format', format) as Promise<boolean>,
  testSound: () => ipcRenderer.invoke('overlay:test-sound') as Promise<boolean>,
  getPresence: () => ipcRenderer.invoke('app:get-presence') as Promise<PresenceEntry[]>,
  onStatus: (callback: (status: OverlayStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OverlayStatus) => callback(status);
    ipcRenderer.on('overlay:status', listener);
    return () => ipcRenderer.removeListener('overlay:status', listener);
  },
  onSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, nextSettings: AppSettings) => callback(nextSettings);
    ipcRenderer.on('overlay:settings-changed', listener);
    return () => ipcRenderer.removeListener('overlay:settings-changed', listener);
  },
  onUpdateDownloaded: (callback: (info: { version: string; releaseNotes: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { version: string; releaseNotes: string }) => callback(info);
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
  onPresence: (callback: (data: PresenceEntry[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: PresenceEntry[]) => callback(data);
    ipcRenderer.on('presence:update', listener);
    return () => ipcRenderer.removeListener('presence:update', listener);
  },
  onUserJoined: (callback: (data: UserJoinedPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: UserJoinedPayload) => callback(data);
    ipcRenderer.on('presence:userJoined', listener);
    return () => ipcRenderer.removeListener('presence:userJoined', listener);
  },
  onUserLeft: (callback: (data: { id: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { id: string }) => callback(data);
    ipcRenderer.on('presence:userLeft', listener);
    return () => ipcRenderer.removeListener('presence:userLeft', listener);
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url) as Promise<void>,
  getObsUrl: () => ipcRenderer.invoke('local-server:get-url') as Promise<string>,
  onObsUrlChanged: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('local-server:url-changed', listener);
    return () => ipcRenderer.removeListener('local-server:url-changed', listener);
  },
  onServerStatus: (callback: (data: { botOnline: boolean; maintenance: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { botOnline: boolean; maintenance: boolean }) => callback(data);
    ipcRenderer.on('server:status', listener);
    return () => ipcRenderer.removeListener('server:status', listener);
  },
  onMaintenance: (callback: (data: { maintenance: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { maintenance: boolean }) => callback(data);
    ipcRenderer.on('server:maintenance', listener);
    return () => ipcRenderer.removeListener('server:maintenance', listener);
  },
});

declare global {
  interface Window {
    livechat: {
      getSettings: () => Promise<AppSettings>;
      getVersion: () => Promise<string>;
      getDisplays: () => Promise<Array<{ id: number; label: string; primary: boolean }>>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      connect: () => Promise<OverlayStatus>;
      disconnect: () => Promise<OverlayStatus>;
      setVolume: (volume: number) => Promise<number>;
      setSize: (size: number) => Promise<number>;
      previewSize: (size: number) => Promise<number>;
      refreshPlacement: () => Promise<boolean>;
      testConnection: (backendUrl: string, guildId: string) => Promise<boolean>;
      triggerTestFormat: (format: string) => Promise<boolean>;
      testSound: () => Promise<boolean>;
      getPresence: () => Promise<PresenceEntry[]>;
      onStatus: (callback: (status: OverlayStatus) => void) => () => void;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
      onUpdateDownloaded: (callback: (info: { version: string; releaseNotes: string }) => void) => () => void;
      onPresence: (callback: (data: PresenceEntry[]) => void) => () => void;
      onUserJoined: (callback: (data: UserJoinedPayload) => void) => () => void;
      onUserLeft: (callback: (data: { id: string }) => void) => () => void;
      installUpdate: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      getObsUrl: () => Promise<string>;
      onObsUrlChanged: (callback: (url: string) => void) => () => void;
      onServerStatus: (callback: (data: { botOnline: boolean; maintenance: boolean }) => void) => () => void;
      onMaintenance: (callback: (data: { maintenance: boolean }) => void) => () => void;
    };
  }
}
