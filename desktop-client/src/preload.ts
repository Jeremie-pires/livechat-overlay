import { contextBridge, ipcRenderer } from 'electron';

type AppSettings = {
  backendUrl: string;
  guildId: string;
  screenId: number;
  volume: number;
  autoConnect: boolean;
  clickThrough: boolean;
};

type OverlayStatus = {
  type: 'idle' | 'loading' | 'connected' | 'error';
  message: string;
};

contextBridge.exposeInMainWorld('livechat', {
  getSettings: () => ipcRenderer.invoke('app:get-settings') as Promise<AppSettings>,
  getDisplays: () => ipcRenderer.invoke('app:get-displays') as Promise<Array<{ id: number; label: string; primary: boolean }>>,
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('app:save-settings', settings) as Promise<AppSettings>,
  connect: () => ipcRenderer.invoke('overlay:connect') as Promise<OverlayStatus>,
  disconnect: () => ipcRenderer.invoke('overlay:disconnect') as Promise<OverlayStatus>,
  setVolume: (volume: number) => ipcRenderer.invoke('overlay:set-volume', volume) as Promise<number>,
  refreshPlacement: () => ipcRenderer.invoke('overlay:refresh-placement') as Promise<boolean>,
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
});

declare global {
  interface Window {
    livechat: {
      getSettings: () => Promise<AppSettings>;
      getDisplays: () => Promise<Array<{ id: number; label: string; primary: boolean }>>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      connect: () => Promise<OverlayStatus>;
      disconnect: () => Promise<OverlayStatus>;
      setVolume: (volume: number) => Promise<number>;
      refreshPlacement: () => Promise<boolean>;
      onStatus: (callback: (status: OverlayStatus) => void) => () => void;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
    };
  }
}
