const { app, BrowserWindow, ipcMain, Tray, Menu, screen, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { checkGitHubUpdate, handleUpdateDownload } = require('./scripts/updater');


let mainWindow = null;
let homeWindow = null;
let tray = null;
let isExpanded = false;

/* ── Exact Reference Dimensions (closed.png & Music.png) ── */
const COLLAPSED_W = 240; // 196px notch + 28px inverted ears + 16px buffer
const COLLAPSED_H = 48;  // 41px notch + 7px shadow buffer
const EXPANDED_W = 584;  // 546px notch + 28px inverted ears + 10px buffer
const EXPANDED_H = 188;  // 178px notch + 10px shadow buffer
const LYRICS_W = 718;    // 680px notch + 28px inverted ears + 10px buffer
const HUD_W = 440;
const HUD_H = 110;

function getTopCenter(w, h) {
  const display = screen.getPrimaryDisplay();
  const sw = display.bounds.width;
  return { x: Math.round((sw - w) / 2), y: 0 };
}

function createWindow() {
  const pos = getTopCenter(COLLAPSED_W, COLLAPSED_H);
  mainWindow = new BrowserWindow({
    width: COLLAPSED_W,
    height: COLLAPSED_H,
    x: pos.x,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', 'nusa-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Prevent file drop from navigating the window
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

let installerWindow = null;

function createInstallerWindow() {
  if (installerWindow) {
    installerWindow.show();
    installerWindow.focus();
    return;
  }
  const display = screen.getPrimaryDisplay();
  const sw = display.bounds.width;
  const sh = display.bounds.height;
  const iw = 660;
  const ih = 440;

  installerWindow = new BrowserWindow({
    width: iw,
    height: ih,
    x: Math.round((sw - iw) / 2),
    y: Math.round((sh - ih) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', 'nusa-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  installerWindow.loadFile(path.join(__dirname, '..', 'installer', 'installer.html'));
  installerWindow.on('closed', () => { installerWindow = null; });
}

ipcMain.on('installer-finish', () => {
  try {
    const flagPath = path.join(app.getPath('userData'), '.installed');
    fs.writeFileSync(flagPath, 'installed=' + Date.now(), 'utf-8');
  } catch (err) {
    console.error('Failed to create .installed flag:', err);
  }

  if (installerWindow) {
    installerWindow.close();
    installerWindow = null;
  }

  createHomeWindow();
});

function createHomeWindow() {
  if (homeWindow) {
    homeWindow.show();
    homeWindow.focus();
    return;
  }
  const display = screen.getPrimaryDisplay();
  const sw = display.bounds.width;
  const sh = display.bounds.height;
  const hw = 1040;
  const hh = 700;

  homeWindow = new BrowserWindow({
    width: hw,
    height: hh,
    minWidth: 860,
    minHeight: 600,
    x: Math.round((sw - hw) / 2),
    y: Math.round((sh - hh) / 2),
    frame: false,
    transparent: false,
    backgroundColor: '#03040a',
    resizable: true,
    hasShadow: true,
    icon: path.join(__dirname, 'assets', 'nusa-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  homeWindow.loadFile(path.join(__dirname, 'home.html'));
  homeWindow.on('closed', () => { homeWindow = null; });
}

/* ── Home Launcher IPC Handlers ── */
ipcMain.on('home-minimize', () => {
  homeWindow?.minimize();
});

ipcMain.on('home-maximize', () => {
  if (homeWindow) {
    if (homeWindow.isMaximized()) homeWindow.unmaximize();
    else homeWindow.maximize();
  }
});

ipcMain.on('home-close', () => {
  homeWindow?.hide();
});


ipcMain.on('home-launch-notch', () => {
  homeWindow?.hide();
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

ipcMain.handle('get-autostart', () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch {
    return false;
  }
});

ipcMain.handle('set-autostart', (_, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      path: process.execPath,
      args: ['--silent']
    });
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('check-update', async () => {

  return await checkGitHubUpdate();
});

ipcMain.handle('download-update', (_, url) => {
  handleUpdateDownload(url);
});

/* ── IPC: Window resize with smooth transition ── */
ipcMain.on('expand-window', (_, opts) => {
  if (!mainWindow) return;
  const w = opts?.width || EXPANDED_W;
  const h = opts?.height || EXPANDED_H;
  const pos = getTopCenter(w, h);
  mainWindow.setBounds({ x: pos.x, y: 0, width: w, height: h });
  isExpanded = true;
});

ipcMain.on('collapse-window', () => {
  if (!mainWindow) return;
  const pos = getTopCenter(COLLAPSED_W, COLLAPSED_H);
  mainWindow.setBounds({ x: pos.x, y: 0, width: COLLAPSED_W, height: COLLAPSED_H });
  isExpanded = false;
});

ipcMain.on('hud-window', (_, opts) => {
  if (!mainWindow) return;
  const w = opts?.width || HUD_W;
  const h = opts?.height || HUD_H;
  const pos = getTopCenter(w, h);
  mainWindow.setBounds({ x: pos.x, y: 0, width: w, height: h });
});

ipcMain.on('set-ignore-mouse', (_, ignore, opts) => {
  mainWindow?.setIgnoreMouseEvents(ignore, opts || { forward: true });
});

/* ── Battery & Power Monitoring (Real-Time Windows Events & Polling) ── */
let cachedBattery = { level: 100, charging: false, hasBattery: false };
let alertedLowBattery = { 15: false, 10: false, 5: false };

function checkLowBatteryAlert(level, isCharging) {
  if (isCharging || !cachedBattery.hasBattery) {
    alertedLowBattery = { 15: false, 10: false, 5: false };
    return;
  }
  if (level <= 5 && !alertedLowBattery[5]) {
    alertedLowBattery[5] = true;
    alertedLowBattery[10] = true;
    alertedLowBattery[15] = true;
    mainWindow?.webContents.send('hud-event', {
      type: 'low-battery',
      level,
      threshold: 5,
    });
  } else if (level <= 10 && !alertedLowBattery[10]) {
    alertedLowBattery[10] = true;
    alertedLowBattery[15] = true;
    mainWindow?.webContents.send('hud-event', {
      type: 'low-battery',
      level,
      threshold: 10,
    });
  } else if (level <= 15 && !alertedLowBattery[15]) {
    alertedLowBattery[15] = true;
    mainWindow?.webContents.send('hud-event', {
      type: 'low-battery',
      level,
      threshold: 15,
    });
  }
}

function pollBattery() {
  exec(
    'powershell -NoProfile -Command "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"',
    { timeout: 3500 },
    (err, stdout) => {
      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout.trim());
          const charging = data.BatteryStatus === 2 || data.BatteryStatus === 6;
          const level = data.EstimatedChargeRemaining || 100;
          if (cachedBattery.hasBattery && cachedBattery.charging !== charging) {
            mainWindow?.webContents.send('hud-event', {
              type: charging ? 'charging' : 'unplugged',
              level,
            });
            if (charging) {
              alertedLowBattery = { 15: false, 10: false, 5: false };
            }
          }
          cachedBattery = { level, charging, hasBattery: true };
          checkLowBatteryAlert(level, charging);
        } catch {
          cachedBattery = { level: 100, charging: false, hasBattery: false };
        }
      }
    }
  );
}
pollBattery();
setInterval(pollBattery, 3000);

// Electron native powerMonitor integration
app.whenReady().then(() => {
  if (powerMonitor) {
    powerMonitor.on('on-ac', () => {
      cachedBattery.charging = true;
      alertedLowBattery = { 15: false, 10: false, 5: false };
      mainWindow?.webContents.send('hud-event', {
        type: 'charging',
        level: cachedBattery.level,
      });
    });
    powerMonitor.on('on-battery', () => {
      cachedBattery.charging = false;
      mainWindow?.webContents.send('hud-event', {
        type: 'unplugged',
        level: cachedBattery.level,
      });
    });
  }
});

ipcMain.handle('get-battery', async () => cachedBattery);

/* ── Windows Drive / Storage Connect & Disconnect Detection ── */
let previousDrives = null;
function pollDrives() {
  exec(
    'powershell -NoProfile -Command "[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady } | Select-Object Name, VolumeLabel, DriveType | ConvertTo-Json -Compress"',
    { timeout: 3500 },
    (err, stdout) => {
      if (!err && stdout) {
        try {
          let parsed = JSON.parse(stdout.trim());
          if (!Array.isArray(parsed)) parsed = [parsed];
          const currentDrives = new Map();
          parsed.forEach((d) => {
            if (d && d.Name) currentDrives.set(d.Name, d);
          });
          if (previousDrives !== null) {
            // New drive detected (Flashdisk / External Hard Drive)
            for (const [name, d] of currentDrives.entries()) {
              if (!previousDrives.has(name) && d.DriveType !== 3 /* Skip internal fixed C: */) {
                const label = d.VolumeLabel || 'USB Drive';
                const cleanName = name.replace(/\\/g, '');
                mainWindow?.webContents.send('hud-event', {
                  type: 'device',
                  action: 'connect',
                  deviceType: 'drive',
                  name: `${label} (${cleanName})`,
                  status: 'Storage connected',
                  isBluetooth: false,
                });
              }
            }
            // Drive disconnected / ejected
            for (const [name, d] of previousDrives.entries()) {
              if (!currentDrives.has(name) && d.DriveType !== 3) {
                const label = d.VolumeLabel || 'USB Drive';
                const cleanName = name.replace(/\\/g, '');
                mainWindow?.webContents.send('hud-event', {
                  type: 'device',
                  action: 'disconnect',
                  deviceType: 'drive',
                  name: `${label} (${cleanName})`,
                  status: 'Ejected / Disconnected',
                  isBluetooth: false,
                });
              }
            }
          }
          previousDrives = currentDrives;
        } catch {}
      }
    }
  );
}
pollDrives();
setInterval(pollDrives, 2500);

ipcMain.on('trigger-hud-test', (_, data) => {
  mainWindow?.webContents.send('hud-event', data);
});

/* ── Media session (asynchronous GSMTC background polling) ── */
let cachedMedia = { playing: false };
let isFetchingMedia = false;
function pollMedia(force = false) {
  if (isFetchingMedia && !force) return;
  isFetchingMedia = true;
  const psFile = path.join(__dirname, 'scripts', 'Get-MediaSession.ps1');
  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
    { timeout: 4000, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout) => {
      isFetchingMedia = false;
      if (!err && stdout) {
        try {
          cachedMedia = JSON.parse(stdout.trim());
          mainWindow?.webContents.send('media-session-update', cachedMedia);
        } catch {}
      }
    }
  );
}
pollMedia();
setInterval(pollMedia, 1000);

ipcMain.handle('get-media-session', async () => cachedMedia);

/* ── IPC: Media control ── */
ipcMain.on('media-control', (_, action, data) => {
  const psFile = path.join(__dirname, 'scripts', 'Control-Media.ps1');
  const posArg = (data && data.position !== undefined) ? `-Position ${data.position}` : '';
  exec(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}" -Action ${action} ${posArg}`,
    { timeout: 3000 },
    () => {
      setTimeout(() => pollMedia(true), 300);
      setTimeout(() => pollMedia(true), 800);
    }
  );
});

/* ── Shelf Demo Files Setup ── */
function setupShelfDemoFiles() {
  const fs = require('fs');
  const demoDir = path.join(app.getPath('userData'), 'ShelfDemo');
  try {
    if (!fs.existsSync(demoDir)) fs.mkdirSync(demoDir, { recursive: true });
    const beachFile = path.join(demoDir, 'beach.jpg');
    if (!fs.existsSync(beachFile)) {
      const sampleSrc = path.join(__dirname, '..', 'assets', 'closed.png');
      if (fs.existsSync(sampleSrc)) {
        fs.copyFileSync(sampleSrc, beachFile);
      } else {
        fs.writeFileSync(beachFile, Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'));
      }
    }
    const projectDir = path.join(demoDir, 'Project files');
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'project_notes.txt'), 'WinNotch Project Files\nCreated: ' + new Date().toLocaleString());
      fs.writeFileSync(path.join(projectDir, 'design_specs.md'), '# Project Design Specs\nDynamic living notch for Windows.');
    }
    return { beach: beachFile, projectFiles: projectDir };
  } catch {
    return { beach: '', projectFiles: '' };
  }
}

/* ── IPC: Shelf File Operations ── */
ipcMain.on('open-file', (_, filePath) => {
  if (!filePath) return;
  const { shell } = require('electron');
  shell.openPath(filePath).then((err) => {
    if (err) {
      shell.showItemInFolder(filePath);
    }
  }).catch(() => {
    shell.showItemInFolder(filePath);
  });
});

ipcMain.on('start-drag', (event, data) => {
  const filePath = typeof data === 'object' && data ? data.file : data;
  const itemId = typeof data === 'object' && data ? data.id : null;
  if (!filePath) return;
  const fs = require('fs');
  const { nativeImage } = require('electron');
  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved)) {
    try {
      const iconPath = path.join(__dirname, 'drag-icon.png');
      let dragIcon = nativeImage.createFromPath(iconPath);
      if (dragIcon.isEmpty()) {
        dragIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'album_cover.png'));
      }
      event.sender.startDrag({
        file: resolved,
        icon: dragIcon,
      });
      event.sender.send('file-dragged-out', { file: resolved, id: itemId });
    } catch (err) {
      console.error('startDrag error:', err);
    }
  }
});

ipcMain.handle('select-shelf-files', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File atau Folder untuk Dimasukkan ke Shelf',
    buttonLabel: 'Tambahkan ke Shelf',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  });
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const fs = require('fs');
    return result.filePaths.map((fp) => {
      const resolved = path.resolve(fp);
      const stat = fs.statSync(resolved);
      const isFolder = stat.isDirectory();
      const name = path.basename(resolved);
      const isImg = isFolder ? false : /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name);
      const sizeStr = isFolder
        ? 'Folder'
        : stat.size > 1048576
        ? `${(stat.size / 1048576).toFixed(1)} MB`
        : `${Math.max(1, Math.round(stat.size / 1024))} KB`;
      return {
        name,
        path: resolved,
        size: sizeStr,
        isFolder,
        isImg,
      };
    });
  }
  return [];
});

ipcMain.on('copy-file', (_, filePath) => {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  exec(`powershell -NoProfile -Command "Set-Clipboard -Path '${resolved.replace(/'/g, "''")}'"`);
});

ipcMain.handle('get-demo-shelf-files', () => {
  return setupShelfDemoFiles();
});

/* ── Notes System (Physical .txt files on disk) ── */
function getNotesDirectory() {
  const fs = require('fs');
  const notesDir = path.join(app.getPath('userData'), 'QuickNotes');
  if (!fs.existsSync(notesDir)) {
    try {
      fs.mkdirSync(notesDir, { recursive: true });
      fs.writeFileSync(
        path.join(notesDir, 'Ideas.txt'),
        'Projek WinNotch Windows:\n- Dynamic Island styling\n- Smooth spring transitions\n- Quick notes drag-and-drop',
        'utf8'
      );
      fs.writeFileSync(
        path.join(notesDir, 'Meeting_Notes.txt'),
        'Meeting Agenda:\n1. Review UI designs\n2. Shelf file transfer\n3. Quick Notes integration',
        'utf8'
      );
    } catch {}
  }
  return notesDir;
}

ipcMain.handle('get-notes', () => {
  const fs = require('fs');
  const notesDir = getNotesDirectory();
  try {
    const files = fs.readdirSync(notesDir);
    const txtFiles = files.filter((f) => f.toLowerCase().endsWith('.txt'));
    return txtFiles.map((name) => {
      const fullPath = path.join(notesDir, name);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      return {
        id: name,
        name: name,
        path: fullPath,
        content: content,
        updatedAt: stat.mtimeMs,
        size: stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${stat.size} B`,
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('get-notes error:', err);
    return [];
  }
});

ipcMain.handle('save-note', (_, { oldName, name, content }) => {
  const fs = require('fs');
  const notesDir = getNotesDirectory();
  try {
    let cleanName = (name || 'Untitled').trim();
    if (!cleanName.toLowerCase().endsWith('.txt')) {
      cleanName += '.txt';
    }
    cleanName = cleanName.replace(/[/\\?%*:|"<>]/g, '_');

    if (oldName && oldName !== cleanName) {
      const oldPath = path.join(notesDir, oldName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fullPath = path.join(notesDir, cleanName);
    fs.writeFileSync(fullPath, content || '', 'utf8');
    const stat = fs.statSync(fullPath);

    return {
      success: true,
      note: {
        id: cleanName,
        name: cleanName,
        path: fullPath,
        content: content || '',
        updatedAt: stat.mtimeMs,
        size: stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${stat.size} B`,
      },
    };
  } catch (err) {
    console.error('save-note error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-note', (_, noteNameOrPath) => {
  const fs = require('fs');
  const notesDir = getNotesDirectory();
  try {
    const filename = path.basename(noteNameOrPath);
    const fullPath = path.join(notesDir, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ── System Tray ── */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'nusa-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Nusa');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Buka Nusa', click: () => mainWindow?.show() },

    { type: 'separator' },
    {
      label: '⚡ Test: Charging & Battery',
      submenu: [
        {
          label: 'Charger Connected (80%)',
          click: () => mainWindow?.webContents.send('hud-event', { type: 'charging', level: 80 }),
        },
        {
          label: 'Charger Disconnected (80%)',
          click: () => mainWindow?.webContents.send('hud-event', { type: 'unplugged', level: 80 }),
        },
        { type: 'separator' },
        {
          label: '⚠️ Low Battery Warning (15%)',
          click: () => mainWindow?.webContents.send('hud-event', { type: 'low-battery', level: 15, threshold: 15 }),
        },
        {
          label: '⚠️ Battery Critical (10%)',
          click: () => mainWindow?.webContents.send('hud-event', { type: 'low-battery', level: 10, threshold: 10 }),
        },
        {
          label: '🚨 Battery Reserve (5%)',
          click: () => mainWindow?.webContents.send('hud-event', { type: 'low-battery', level: 5, threshold: 5 }),
        },
      ],
    },
    {
      label: '🎧 Test: Device Connections',
      submenu: [
        {
          label: 'AirBuds Pro Connected (70%)',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'headphones',
            name: 'AirBuds Pro',
            battery: 70,
            isBluetooth: true,
          }),
        },
        {
          label: 'AirBuds Pro Disconnected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'disconnect',
            deviceType: 'headphones',
            name: 'AirBuds Pro',
            isBluetooth: true,
          }),
        },
        {
          label: 'Wired Headphones Connected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'headphones',
            name: 'Studio Headphones',
            isBluetooth: false,
          }),
        },
        { type: 'separator' },
        {
          label: 'USB Flashdisk Connected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'drive',
            name: 'SanDisk 32GB (E:)',
            isBluetooth: false,
          }),
        },
        {
          label: 'USB Flashdisk Ejected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'disconnect',
            deviceType: 'drive',
            name: 'SanDisk 32GB (E:)',
            isBluetooth: false,
          }),
        },
        {
          label: 'External Hard Drive Connected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'drive',
            name: 'Backup Plus 2TB (F:)',
            isBluetooth: false,
          }),
        },
        { type: 'separator' },
        {
          label: 'Wireless Mouse Connected (85%)',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'mouse',
            name: 'Logitech G Pro',
            battery: 85,
            isBluetooth: true,
          }),
        },
        {
          label: 'Wireless Mouse Disconnected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'disconnect',
            deviceType: 'mouse',
            name: 'Logitech G Pro',
            isBluetooth: true,
          }),
        },
        {
          label: 'Mechanical Keyboard Connected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'keyboard',
            name: 'Keychron K2',
            isBluetooth: false,
          }),
        },
        {
          label: 'Keyboard Disconnected',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'disconnect',
            deviceType: 'keyboard',
            name: 'Keychron K2',
            isBluetooth: false,
          }),
        },
        {
          label: 'Bluetooth Speaker Connected (60%)',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'device',
            action: 'connect',
            deviceType: 'speaker',
            name: 'JBL Flip 6',
            battery: 60,
            isBluetooth: true,
          }),
        },
      ],
    },
    {
      label: '💬 Test: Incoming Messages',
      submenu: [
        {
          label: 'WhatsApp: Dina ("Bro, filenya udah ku kirim ya")',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'message',
            app: 'whatsapp',
            sender: 'Dina',
            text: 'Bro, filenya udah ku kirim ya. Tolong dicek ya!',
          }),
        },
        {
          label: 'Telegram: Alex ("Living notch v1.0 siap dirilis")',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'message',
            app: 'telegram',
            sender: 'Alex',
            text: 'Living notch v1.0 sudah siap dirilis ke GitHub!',
          }),
        },
        {
          label: 'Discord: Gaming Guild ("Mabar yuk! Slot 1 lagi")',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'message',
            app: 'discord',
            sender: 'Gaming Guild',
            text: 'Mabar yuk! Slot lobby tersisa 1 orang lagi nih.',
          }),
        },
        {
          label: 'SMS: Bank BCA ("Kode OTP Anda: 829104")',
          click: () => mainWindow?.webContents.send('hud-event', {
            type: 'message',
            app: 'generic',
            sender: 'Bank BCA',
            text: 'Kode OTP Anda: 829104. Jangan berikan kepada siapa pun.',
          }),
        },
      ],
    },
    {
      label: '⚙️ Buka Pengaturan (Home Dashboard)',
      click: () => createHomeWindow(),
    },
    { type: 'separator' },
    { label: 'Quit WinNotch', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

/* ── Local Notification Webhook API (for browser scripts, extensions, or curl) ── */
const http = require('http');
function startNotificationServer() {
  try {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://127.0.0.1:3457');
      if (url.pathname === '/api/notify' || url.pathname === '/notify') {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              mainWindow?.webContents.send('hud-event', {
                type: 'message',
                app: data.app || 'whatsapp',
                sender: data.sender || 'Seseorang',
                text: data.text || data.message || 'Pesan baru'
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', delivered: true }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        } else {
          // GET query parameters: ?app=whatsapp&sender=Dina&text=Halo
          const app = url.searchParams.get('app') || 'whatsapp';
          const sender = url.searchParams.get('sender') || 'Seseorang';
          const text = url.searchParams.get('text') || 'Pesan baru';
          mainWindow?.webContents.send('hud-event', {
            type: 'message',
            app,
            sender,
            text
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', delivered: true }));
          return;
        }
      }

      if (url.pathname === '/api/reload') {
        mainWindow?.webContents.reloadIgnoringCache();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'reloaded' }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(3457, '127.0.0.1', () => {
      console.log('[WinNotch] Notification webhook listener active on http://127.0.0.1:3457/api/notify');
    });

    server.on('error', () => {});
  } catch {}
}

/* ── Real-Time Windows System Toast Notification Watcher ── */
let notifWatcherProcess = null;
function startNotificationWatcher() {
  const psScript = path.join(__dirname, 'scripts', 'Watch-Notifications.ps1');
  if (!fs.existsSync(psScript)) return;

  try {
    notifWatcherProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript
    ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });

    let buffer = '';
    notifWatcherProcess.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('{')) continue;
        try {
          const data = JSON.parse(trimmed);
          if (data.ready) {
            console.log(`[WinNotch] Windows Notification Listener active (tracking ${data.tracked} notifications)`);
          } else if (data.sender && data.text) {
            console.log(`[WinNotch] Auto-detected incoming message: [${data.app}] ${data.sender}: ${data.text}`);
            mainWindow?.webContents.send('hud-event', {
              type: 'message',
              app: data.app || 'generic',
              sender: data.sender,
              text: data.text
            });
          }
        } catch {}
      }
    });

    notifWatcherProcess.on('exit', () => {
      notifWatcherProcess = null;
      setTimeout(startNotificationWatcher, 3000);
    });
  } catch (err) {
    console.error('Failed to start notification watcher:', err);
  }
}

/* ── App lifecycle ── */
app.whenReady().then(() => {
  const isSilent = process.argv.includes('--silent');
  const isInstall = process.argv.includes('--install');
  const flagPath = path.join(app.getPath('userData'), '.installed');
  const isInstalled = fs.existsSync(flagPath);

  if (isSilent) {
    createWindow();
  } else if (!isInstalled || isInstall) {
    createInstallerWindow();
  } else {
    createHomeWindow();
  }
  createTray();

  startNotificationServer();
  startNotificationWatcher();

  // Background auto-updater check
  setTimeout(async () => {
    try {
      const update = await checkGitHubUpdate();
      if (update && update.hasUpdate) {
        mainWindow?.webContents.send('hud-event', {
          type: 'message',
          app: 'generic',
          sender: 'Pembaruan Tersedia',
          text: `Versi ${update.version} telah dirilis. Buka Home untuk memperbarui.`
        });
      }
    } catch {}
  }, 10000);
});

app.on('will-quit', () => {
  try { notifWatcherProcess?.kill(); } catch {}
});

app.on('window-all-closed', () => app.quit());


