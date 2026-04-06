import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => {
      const wrapped = (_event, ...args) => listener(...args);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    }
  },
  sendNotification: (payload) => ipcRenderer.invoke('electron:notify', payload),
  openFile: (options) => ipcRenderer.invoke('electron:file:open', options),
  saveFile: (options) => ipcRenderer.invoke('electron:file:save', options)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
