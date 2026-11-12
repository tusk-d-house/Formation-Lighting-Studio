const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  showOpenDialog: () => ipcRenderer.invoke('dialog:open-project'),
  showSaveDialog: (defaultFileName) => ipcRenderer.invoke('dialog:save-project-as', { defaultFileName }),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:save-file', { filePath, content }),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', { filePath }),
  loadProjects: () => ipcRenderer.invoke('storage:load-projects'),
  saveProjects: (projectsJson) => ipcRenderer.invoke('storage:save-projects', { projectsJson }),
  saveAudio: (data) => ipcRenderer.invoke('storage:save-audio', data),
  loadAudio: (projectId) => ipcRenderer.invoke('storage:load-audio', { projectId }),
  deleteAudio: (projectId) => ipcRenderer.invoke('storage:delete-audio', { projectId }),
  cloneAudio: (sourceId, targetId) => ipcRenderer.invoke('storage:clone-audio', { sourceId, targetId }),
});
