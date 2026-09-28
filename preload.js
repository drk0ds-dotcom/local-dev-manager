const { contextBridge, ipcRenderer } = require('electron');

const send = (channel, ...args) => ipcRenderer.send(channel, ...args);
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// تسجيل مستمع لقناة وإرجاع دالة لإلغاء التسجيل
const on = (channel) => (callback) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
  // تحكم النافذة
  closeApp:    () => send('app-close'),
  minimizeApp: () => send('app-minimize'),
  maximizeApp: () => send('app-maximize'),

  // إدارة المشاريع
  start:      (id)       => send('start', id),
  stop:       (id)       => send('stop', id),
  restart:    (id)       => send('restart', id),
  open:       (id, port) => send('open', { id, port }),
  addProject: ()         => send('add-project'),
  remove:     (id)       => send('remove-project', id),
  savePort:   (id, port) => send('save-port', { id, port }),

  // إعدادات وأدوات المشروع
  updatePort:      (id, port) => send('update-port', { id, port }),
  toggleAutoStart: (id)       => send('toggle-autostart', id),
  toggleAutoRestart: (id)     => send('toggle-autorestart', id),
  updateGroup:     (id, group) => send('update-group', { id, group }),
  reorder:         (orderedIds) => send('reorder-projects', orderedIds),
  sendInput:       (id, text) => send('send-input', { id, text }),
  openFolder:      (id)       => send('open-folder', id),
  openInCode:      (id)       => send('open-in-code', id),
  exportLogs:      (id, content) => send('export-logs', { id, content }),

  // اللغة والفحوصات
  setLanguage: (lang)      => send('set-language', lang),
  checkPort:   (port)      => invoke('check-port', port),
  clearLogs:   (id)        => send('clear-logs', id),

  // أحداث من العملية الرئيسية
  onProjectsData:  on('projects-data'),
  onProjectStatus: on('project-status'),
  onProjectLog:    on('project-log'),
  onProjectPort:   on('project-port'),
  onProjectStats:  on('project-stats'),
  onLogsData:      on('logs-data')
});
