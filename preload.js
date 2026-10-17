
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fluxAPI', {
  loadData: () => ipcRenderer.invoke('flux:load-data'),

  saveData: (type, data) =>
    ipcRenderer.invoke('flux:save-data', { type, data })
});
