import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
  shell
} from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dashboardDir = path.join(rootDir, 'dashboard');
const dashboardOutDir = path.join(dashboardDir, 'out');
const dashboardIndexFile = path.join(dashboardOutDir, 'index.html');

const isDev = process.env.ELECTRON_DEV === '1' || process.env.NODE_ENV === 'development';
const devServerUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:3000';

let mainWindow = null;
let tray = null;

function createTray() {
  if (tray) {
    return tray;
  }

  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('AI Team Dashboard');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (!mainWindow) {
          createMainWindow();
          return;
        }
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Open Dashboard Folder',
      click: () => shell.openPath(dashboardDir)
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  return tray;
}

async function loadRenderer(window) {
  if (isDev) {
    await window.loadURL(devServerUrl);
    return;
  }

  await window.loadFile(dashboardIndexFile);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  loadRenderer(mainWindow).catch((error) => {
    console.error('Failed to load renderer', error);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' || !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function showNativeNotification({ title, body }) {
  if (!Notification.isSupported()) {
    return { ok: false, reason: 'notifications-not-supported' };
  }

  const notification = new Notification({
    title: title || 'AI Team Dashboard',
    body: body || ''
  });
  notification.show();
  return { ok: true };
}

ipcMain.handle('electron:notify', async (_event, payload = {}) => {
  return showNativeNotification(payload);
});

ipcMain.handle('electron:file:open', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options
  });
  return result;
});

ipcMain.handle('electron:file:save', async (_event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep tray app alive unless the user explicitly quits.
  }
});
