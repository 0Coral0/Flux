
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fluxAPI', {
  loadData: () => ipcRenderer.invoke('flux:load-data'),

  listUnusedGameAssets: () => ipcRenderer.invoke('flux:list-unused-game-assets'),

  saveData: (type, data) =>
    ipcRenderer.invoke('flux:save-data', { type, data })
});
