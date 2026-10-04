const { contextBridge, ipcRenderer } = require('electron');
const LOG_CAP = ipcRenderer.sendSync('get-log-cap');

const send = (channel, ...args) => ipcRenderer.send(channel, ...args);
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// Register an IPC listener and return a function that unsubscribes it.
const on = (channel) => (callback) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
  logCap: LOG_CAP,
  // Window controls
  closeApp: () => send('app-close'),
  minimizeApp: () => send('app-minimize'),
  maximizeApp: () => send('app-maximize'),

  // Project lifecycle
  start: (id) => send('start', id),
  stop: (id) => send('stop', id),
  restart: (id) => send('restart', id),
  open: (id) => send('open', { id }),
  addProject: () => send('add-project'),
  submitProject: (config) => send('create-project', config),
  cancelAddProject: () => send('cancel-add-project'),
  remove: (id) => send('remove-project', id),

  // Project settings and tools
  updatePort: (id, port) => send('update-port', { id, port }),
  updateCustomCommand: (id, command) => send('update-custom-command', { id, command }),
  toggleAutoStart: (id) => send('toggle-autostart', id),
  toggleAutoRestart: (id) => send('toggle-autorestart', id),
  updateGroup: (id, group) => send('update-group', { id, group }),
  reorder: (orderedIds) => send('reorder-projects', orderedIds),
  sendInput: (id, text) => send('send-input', { id, text }),
  openFolder: (id) => send('open-folder', id),
  openInCode: (id) => send('open-in-code', id),
  exportLogs: (id, content) => send('export-logs', { id, content }),

  // Language and checks
  setLanguage: (lang) => send('set-language', lang),
  checkPort: (port) => invoke('check-port', port),
  clearLogs: (id) => send('clear-logs', id),

  // Events from the main process
  onProjectsData: on('projects-data'),
  onAddProjectSelection: on('add-project-selection'),
  onAddProjectError: on('add-project-error'),
  onProjectSettingsError: on('project-settings-error'),
  onProjectStatus: on('project-status'),
  onProjectLog: on('project-log'),
  onProjectPort: on('project-port'),
  onProjectStats: on('project-stats'),
  onLogsData: on('logs-data')
});
