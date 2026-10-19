const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('winNotch', {
  /* Window control */
  expandWindow: (opts) => ipcRenderer.send('expand-window', opts),
  collapseWindow: () => ipcRenderer.send('collapse-window'),
  hudWindow: (opts) => ipcRenderer.send('hud-window', opts),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  /* Battery */
  getBattery: () => ipcRenderer.invoke('get-battery'),

  /* Media */
  getMediaSession: () => ipcRenderer.invoke('get-media-session'),
  mediaControl: (action, data) => ipcRenderer.send('media-control', action, data),
  onMediaUpdate: (callback) => ipcRenderer.on('media-session-update', (_, data) => callback(data)),

  /* File & Notes operations */
  openFile: (filePath) => ipcRenderer.send('open-file', filePath),
  startDrag: (data) => ipcRenderer.send('start-drag', data),
  copyFile: (filePath) => ipcRenderer.send('copy-file', filePath),
  getDemoShelfFiles: () => ipcRenderer.invoke('get-demo-shelf-files'),
  selectShelfFiles: () => ipcRenderer.invoke('select-shelf-files'),
  onFileDraggedOut: (callback) => ipcRenderer.on('file-dragged-out', (_, data) => callback(data)),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  saveNote: (noteData) => ipcRenderer.invoke('save-note', noteData),
  deleteNote: (notePath) => ipcRenderer.invoke('delete-note', notePath),
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
      return file.path || '';
    } catch {
      return file.path || '';
    }
  },

  /* HUD events from main process */
  onHudEvent: (callback) => ipcRenderer.on('hud-event', (_, data) => callback(data)),
});

contextBridge.exposeInMainWorld('winNotchHome', {
  minimize: () => ipcRenderer.send('home-minimize'),
  maximize: () => ipcRenderer.send('home-maximize'),
  close: () => ipcRenderer.send('home-close'),
  launchNotch: () => ipcRenderer.send('home-launch-notch'),
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url)
});


contextBridge.exposeInMainWorld('winNotchInstaller', {
  finish: () => ipcRenderer.send('installer-finish')
});


