const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');

const { createProcessManager } = require('./processManager');
const { startProjectWithChecks } = require('./projectStarter');
const { LOG_CAP } = require('./logConfig');
const { createResourceMonitor } = require('./resourceMonitor');
const { createResourcePolling } = require('./resourcePolling');
const { registerIpcHandlers } = require('./ipcHandlers');
const { createProjectRegistry } = require('./projectRegistry');
const { openInCode } = require('./codeLauncher');
const { isPackageManagerAvailable } = require('./packageManagerAvailability');
const { createLogService } = require('./logService');
const { createUpdateController } = require('./updateController');
const { createTrayController } = require('./trayController');
const { formatAppMessage } = require('./messages');

let win;
let registry;
let manager;
const currentProjects = () => registry.snapshot();

// Keep dynamically detected ports separate from the configured project ports.
let detectedPorts = {};

function startManagedProject(id) {
  if (!isKnownId(id)) return Promise.resolve('unknown-project');

  return startProjectWithChecks({
    id,
    project: registry.get(id),
    packageManager: manager.detectPackageManager(registry.get(id).path),
    isPackageManagerAvailable,
    status: manager.getStatus(id),
    win,
    isPortInUse: manager.isPortInUse,
    startProject: manager.startProject,
    sendLog,
    packageManagerUnavailableMessage: (name) => msg('packageManagerUnavailable', name),
    portBusyMessage: (port) => msg('portBusy', port)
  });
}

// ======================
// Main-process messages follow the UI language (English by default).
// ======================
let uiLang = 'en';

function msg(key, ...args) {
  return formatAppMessage(uiLang, key, ...args);
}

let logs;
let trayController;

function sendLog(id, type, message) {
  logs?.append(id, type, message);
}

// ======================
// VALIDATION
// ======================
const isKnownId = (id) => typeof id === 'string' && !!registry?.get(id);
const isValidPort = (p) => Number.isInteger(p) && p >= 1 && p <= 65535;

// ======================
// WINDOW
// ======================
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0e0f13'
  });

  // Remove the default menu so shortcuts such as Ctrl+R do not affect the UI.
  win.setMenu(null);

  trayController.attachCloseHandler(win);

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('projects-data', currentProjects());
    win.webContents.send('logs-data', logs.snapshot());

    if (registry.loadIssue()) {
      dialog.showErrorBox(
        msg('projectsLoadTitle'),
        msg('projectsLoadFailed', registry.loadIssue().backupPath, registry.path())
      );
    }

    // Start projects that have automatic startup enabled.
    for (const p of Object.values(currentProjects())) {
      if (p.autoStart) startManagedProject(p.id);
    }
  });
}

let resourcePolling;

let updates;

// ======================
// SINGLE INSTANCE LOCK
// A second instance quits immediately and focuses the existing window.
// This prevents competing writes to projects.json or killing another instance's children.
// ======================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  manager = createProcessManager();
  manager.setLogSink((id, type, message) => sendLog(id, type, message));
  manager.setPortSink((id, port) => {
    if (isKnownId(id) && isValidPort(port)) detectedPorts[id] = port;
  });
  manager.setStatusSink((id, status) => {
    if (status !== 'running') delete detectedPorts[id];
  });
  registry = createProjectRegistry({ userDataDir: app.getPath('userData'), appDir: __dirname });
  registry.load();
  logs = createLogService({
    directory: path.join(app.getPath('userData'), 'logs'),
    cap: LOG_CAP,
    isKnownId,
    send: (channel, payload) => win?.webContents.send(channel, payload),
    onError: (err) => console.error('⚠️ Failed to persist logs:', err.message)
  });
  logs.load();
  trayController = createTrayController({
    app,
    Tray,
    Menu,
    nativeImage,
    iconPath: path.join(__dirname, 'assets', 'icon.png'),
    getWindow: () => win,
    msg,
    stopAllProjects: manager.stopAllProjects,
    dialog,
    markerPath: path.join(app.getPath('userData'), 'tray-close-notice-seen'),
    isQuitting: () => isQuitting,
    onError: (error) => console.error('Tray unavailable:', error.message)
  });
  updates = createUpdateController({
    isPackaged: app.isPackaged,
    loadUpdater: () => require('electron-updater').autoUpdater,
    dialog,
    getWindow: () => win,
    msg,
    onError: (err) => console.error('Update error:', err.message)
  });
  resourcePolling = createResourcePolling({
    monitor: createResourceMonitor(),
    getRunningPids: manager.getRunningPids,
    getWindow: () => win,
    onError: (err) => console.error('Resource monitoring unavailable:', err)
  });
  resourcePolling.start();

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    trayController.create();

    updates.start();
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

// ======================
// Stop all managed child processes before quitting.
// ======================
let isQuitting = false; // A real Quit closes the window instead of hiding it to the tray.
let cleanupDone = false; // Managed-process cleanup has already started.

app.on('before-quit', (event) => {
  if (!gotTheLock) return;
  // Any Quit request, from the tray or system, closes instead of hiding the window.
  isQuitting = true;
  updates?.stop();
  resourcePolling?.stop();

  if (cleanupDone) return;

  event.preventDefault();
  cleanupDone = true;

  Promise.resolve()
    .then(() => (manager.hasRunningProcesses() ? manager.stopAllProjects() : null))
    .finally(() => logs.close())
    .finally(() => app.quit());
});

if (gotTheLock)
  registerIpcHandlers({
    ipcMain,
    getWindow: () => win,
    registry,
    logs,
    manager,
    tray: trayController,
    ports: {
      get: (id) => detectedPorts[id],
      set: (id, port) => {
        detectedPorts[id] = port;
      },
      delete: (id) => {
        delete detectedPorts[id];
      }
    },
    shell,
    dialog,
    fs,
    createId: () => crypto.randomUUID(),
    findFreePort: manager.findFreePort,
    startManagedProject,
    isPackageManagerAvailable,
    detectPackageManager: manager.detectPackageManager,
    openInCode,
    isPortInUse: manager.isPortInUse,
    msg,
    setLanguage: (lang) => {
      uiLang = lang;
      manager.setUiLanguage(lang);
    },
    logCap: LOG_CAP
  });
