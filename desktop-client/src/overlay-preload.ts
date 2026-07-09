import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('livechatOverlay', {
  reportPresence: (data: unknown) => {
    ipcRenderer.send('presence:update', data);
  },
});
