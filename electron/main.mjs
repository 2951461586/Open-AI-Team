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

function createMenu() {
  const template = [
    {
      label: 'AI Team',
      submenu: [
        {
          label: 'About AI Team',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About AI Team',
              message: 'AI Team Dashboard',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('navigate', '/settings');
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            mainWindow?.setAlwaysOnTop(menuItem.checked);
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/ai-team/ai-team#readme');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/ai-team/ai-team/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Open Logs Folder',
          click: () => {
            const logDir = path.join(rootDir, 'logs');
            shell.openPath(logDir).catch(() => {});
          },
        },
        {
          label: 'Open Data Folder',
          click: () => {
            const dataDir = path.join(rootDir, 'data');
            shell.openPath(dataDir).catch(() => {});
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

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
      label: 'Hide Dashboard',
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Quick Actions',
      submenu: [
        {
          label: 'New Chat',
          click: () => {
            mainWindow?.webContents.send('navigate', '/chat/new');
            mainWindow?.show();
          },
        },
        {
          label: 'View Tasks',
          click: () => {
            mainWindow?.webContents.send('navigate', '/tasks');
            mainWindow?.show();
          },
        },
        {
          label: 'View Agents',
          click: () => {
            mainWindow?.webContents.send('navigate', '/agents');
            mainWindow?.show();
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard Folder',
      click: () => shell.openPath(dashboardDir)
    },
    {
      label: 'Open Logs',
      click: () => shell.openPath(path.join(rootDir, 'logs')).catch(() => {})
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.webContents.send('navigate', '/settings');
        mainWindow?.show();
      },
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
  createMenu();
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
