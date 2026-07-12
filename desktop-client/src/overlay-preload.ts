import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('livechatOverlay', {
  reportPresence: (data: unknown) => {
    ipcRenderer.send('presence:update', data);
  },
  reportUserJoined: (data: unknown) => {
    ipcRenderer.send('presence:userJoined', data);
  },
  reportUserLeft: (data: unknown) => {
    ipcRenderer.send('presence:userLeft', data);
  },
});
