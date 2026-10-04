// ──────────────────────────
// I18N
// ──────────────────────────
const I18N = {
  ar: {
    configureProject: 'إعداد المشروع',
    projectMode: 'نوع المشروع',
    nodeScript: 'أمر Node.js',
    customCommand: 'أمر مخصص',
    commandLabel: 'الأمر',
    optionalPort: 'المنفذ (اختياري للأمر المخصص)',
    commandWarning: 'تُشغّل الأوامر المخصصة محليًا بصلاحيات حساب Windows الخاص بك. أدخل الأوامر التي تثق بها فقط.',
    cancel: 'إلغاء',
    saveProject: 'إضافة المشروع',
    invalidCommand: 'أدخل أمرًا مخصصًا صالحًا.',
    invalidPort: 'أدخل منفذًا بين 1 و65535 أو اتركه فارغًا للأمر المخصص.',
    saveCommand: 'حفظ الأمر',
    commandNextStart: 'سيُستخدم الأمر الجديد عند التشغيل التالي.',
    noPortText: 'بلا منفذ',
    noPortTitle: 'هذا المشروع لا يستخدم منفذًا للشبكة.',
    projects: 'المشاريع',
    addProject: 'إضافة مشروع',
    emptyState: 'اختر مشروعًا أو أضف مشروعًا جديدًا',
    start: 'تشغيل',
    stop: 'إيقاف',
    restart: 'إعادة تشغيل',
    open: 'فتح',
    folder: 'مجلد',
    auto: 'تلقائي',
    consoleOutput: 'مخرجات الطرفية',
    clear: 'مسح',
    export: 'تصدير',
    searchPh: 'بحث في السجلات...',
    portTitle: 'البورت المخصص — Enter للحفظ',
    deleteTitle: 'حذف المشروع',
    autoOn: 'التشغيل التلقائي مفعّل — اضغط للتعطيل',
    autoOff: 'تفعيل التشغيل التلقائي مع إقلاع التطبيق',
    running: 'يعمل',
    stopped: 'متوقف',
    booting: 'جارٍ الإقلاع...',
    langBtn: 'EN',
    confirmDelete: (n) => `حذف المشروع "${n}" من القائمة؟`,
    portBusyText: '⚠ مشغول',
    portFreeText: '✓ حر',
    portBusyTitle: 'هذا البورت مشغول حالياً — غيّره قبل التشغيل',
    portFreeTitle: 'البورت حر',
    portSelfText: '● خادمك',
    portSelfTitle: 'البورت يشغله خادم هذا المشروع نفسه — كل شيء طبيعي',
    autoRestart: 'إعادة تلقائية',
    autoRestartOn: 'إعادة التشغيل التلقائي عند الانهيار مفعّلة — اضغط للتعطيل',
    autoRestartOff: 'إعادة التشغيل تلقائياً عندما ينهار المشروع',
    groupPh: 'اسم المجموعة — Enter للحفظ',
    searchProjectsPh: 'بحث في المشاريع...',
    stdinPh: 'إدخال تفاعلي للمشروع — Enter للإرسال',
    stdinSend: 'إرسال',
    closeWindow: 'إغلاق النافذة إلى منطقة الإشعارات',
    minimizeWindow: 'تصغير النافذة',
    maximizeWindow: 'تكبير النافذة',
    switchLanguage: 'Switch to English',
    statsUnavailable: 'CPU/RAM غير متاح'
  },
  en: {
    configureProject: 'Configure project',
    projectMode: 'Project type',
    nodeScript: 'Node.js script',
    customCommand: 'Custom command',
    commandLabel: 'Command',
    optionalPort: 'Port (optional for custom commands)',
    commandWarning:
      "Custom commands run locally with your Windows account's permissions. Only enter commands you trust.",
    cancel: 'Cancel',
    saveProject: 'Add project',
    invalidCommand: 'Enter a valid custom command.',
    invalidPort: 'Enter a port from 1 to 65535, or leave it blank for a custom command.',
    saveCommand: 'Save command',
    commandNextStart: 'Changes take effect on the next start.',
    noPortText: 'No port',
    noPortTitle: 'This project has no network port.',
    projects: 'Projects',
    addProject: 'Add Project',
    emptyState: 'Select a project or add a new one',
    start: 'Start',
    stop: 'Stop',
    restart: 'Restart',
    open: 'Open',
    folder: 'Folder',
    auto: 'Auto',
    consoleOutput: 'Console Output',
    clear: 'Clear',
    export: 'Export',
    searchPh: 'Search logs...',
    portTitle: 'Assigned port — Enter to save',
    deleteTitle: 'Delete project',
    autoOn: 'Autostart enabled — click to disable',
    autoOff: 'Start automatically with the app',
    running: 'Running',
    stopped: 'Stopped',
    booting: 'Booting...',
    langBtn: 'ع',
    confirmDelete: (n) => `Remove project "${n}" from the list?`,
    portBusyText: '⚠ In use',
    portFreeText: '✓ Free',
    portBusyTitle: 'This port is currently in use — change it before starting',
    portFreeTitle: 'Port is free',
    portSelfText: '● Your server',
    portSelfTitle: "This port is served by this project's own server — everything is normal",
    autoRestart: 'Auto-restart',
    autoRestartOn: 'Auto-restart on crash enabled — click to disable',
    autoRestartOff: 'Restart automatically when the project crashes',
    groupPh: 'Group name — Enter to save',
    searchProjectsPh: 'Search projects...',
    stdinPh: 'Interactive input for the project — Enter to send',
    stdinSend: 'Send',
    closeWindow: 'Close window to system tray',
    minimizeWindow: 'Minimize window',
    maximizeWindow: 'Maximize window',
    switchLanguage: 'Switch to Arabic',
    statsUnavailable: 'CPU/RAM unavailable'
  }
};

let lang = localStorage.getItem('ldm-lang') || 'en'; // English by default

function t(key, ...args) {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Keep main-process log messages and the tray menu in the selected language.
  window.api.setLanguage(lang);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });

  document.getElementById('lang-btn').textContent = t('langBtn');
  updateStatusBadge(currentProject ? projectStatus[currentProject] || 'stopped' : 'stopped');
  updateAutoStartBtn();
  updateAutoRestartBtn();
  renderProjectStats();
  if (currentProject) refreshPortStatus(currentProject);
}

// ──────────────────────────
// STATE
// ──────────────────────────
let currentProject = null;
let projects = {};
let projectStatus = {};
let projectLogs = {}; // logs per project
let projectPorts = {}; // ports per project
let projectResourceStatus = {};
let runningSince = {}; // Start time for each project
let logFilter = '';
let sidebarFilter = ''; // Sidebar search query
let draggedId = null; // Project currently being dragged in the sidebar

const MAX_LOG_LINES = window.api.logCap;

// ──────────────────────────
// HELPERS
// ──────────────────────────
function projectName(id) {
  return projects[id]?.name || id;
}

function openProject(id) {
  if (id && projects[id]?.port != null) window.api.open(id);
}

document.getElementById('app-close').addEventListener('click', () => window.api.closeApp());
document.getElementById('app-minimize').addEventListener('click', () => window.api.minimizeApp());
document.getElementById('app-maximize').addEventListener('click', () => window.api.maximizeApp());
document.getElementById('add-project').addEventListener('click', () => window.api.addProject());
const addDialog = document.getElementById('add-project-dialog');
const addForm = document.getElementById('new-project-form');
const addMode = document.getElementById('new-project-mode');
const addCommand = document.getElementById('new-custom-command');
const addPort = document.getElementById('new-project-port');
const addError = document.getElementById('new-project-error');
let addSelection = null;

function updateAddMode() {
  const custom = addMode.value === 'custom';
  document.getElementById('new-command-row').hidden = !custom;
  document.getElementById('new-project-warning').hidden = !custom;
  addPort.required = !custom;
}

addMode.addEventListener('change', () => {
  addPort.value = addMode.value === 'custom' ? '' : String(addSelection?.suggestedPort ?? '');
  addError.textContent = '';
  updateAddMode();
});
window.api.onAddProjectSelection((selection) => {
  addSelection = selection;
  document.getElementById('new-project-path').textContent = selection.path;
  addMode.querySelector('option[value="node"]').disabled = !selection.hasNodeScript;
  addMode.value = selection.hasNodeScript ? 'node' : 'custom';
  addCommand.value = '';
  addPort.value = selection.hasNodeScript ? String(selection.suggestedPort ?? '') : '';
  addError.textContent = '';
  updateAddMode();
  addDialog.showModal();
  (addMode.value === 'custom' ? addCommand : addPort).focus();
});
window.api.onAddProjectError((message) => {
  if (addDialog.open) addError.textContent = message;
});
addDialog.addEventListener('close', () => {
  addSelection = null;
  window.api.cancelAddProject();
});
document.getElementById('new-project-cancel').addEventListener('click', () => addDialog.close());
addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const custom = addMode.value === 'custom';
  const port = addPort.value.trim() ? Number(addPort.value) : null;
  if (custom && !addCommand.value.trim()) return void (addError.textContent = t('invalidCommand'));
  if ((!custom && port === null) || (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)))
    return void (addError.textContent = t('invalidPort'));
  window.api.submitProject({ mode: addMode.value, customCommand: custom ? addCommand.value : undefined, port });
});
document.getElementById('project-start').addEventListener('click', () => window.api.start(currentProject));
document.getElementById('project-stop').addEventListener('click', () => window.api.stop(currentProject));
document.getElementById('project-restart').addEventListener('click', () => window.api.restart(currentProject));
document.getElementById('project-open').addEventListener('click', () => openProject(currentProject));
document.getElementById('project-code').addEventListener('click', () => window.api.openInCode(currentProject));
document.getElementById('project-folder').addEventListener('click', () => window.api.openFolder(currentProject));
document.getElementById('autostart-btn').addEventListener('click', () => window.api.toggleAutoStart(currentProject));
document
  .getElementById('autorestart-btn')
  .addEventListener('click', () => window.api.toggleAutoRestart(currentProject));

// ──────────────────────────
// SIDEBAR
// Build DOM nodes instead of injecting untrusted folder names through innerHTML.
// Support instant search, grouping, and drag-and-drop ordering.
// ──────────────────────────
function buildProjectItem(p) {
  const el = document.createElement('div');
  el.className = 'project-item' + (p.id === currentProject ? ' active' : '');
  el.dataset.id = p.id;
  el.title = p.path;
  el.draggable = true;

  const dot = document.createElement('span');
  dot.className = `project-dot ${projectStatus[p.id] || 'stopped'}`;

  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'project-name project-select';
  name.textContent = p.name;
  if (p.id === currentProject) name.setAttribute('aria-current', 'true');

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'project-delete';
  del.title = t('deleteTitle');
  del.setAttribute('aria-label', `${t('deleteTitle')}: ${p.name}`);
  del.textContent = '✕';
  del.addEventListener('click', (e) => removeProject(e, p.id));

  el.append(dot, name, del);
  el.addEventListener('click', () => selectProject(p.id));

  // Drag and drop to reorder projects.
  el.addEventListener('dragstart', (e) => {
    draggedId = p.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    draggedId = null;
    el.classList.remove('dragging');
  });
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedId || draggedId === p.id) return;

    const ids = Object.values(projects)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((x) => x.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(p.id);
    if (from === -1 || to === -1) return;

    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);

    // Update the sidebar immediately, then persist the new order in main.
    ids.forEach((id, i) => {
      if (projects[id]) projects[id].order = i;
    });
    renderSidebar();
    window.api.reorder(ids);
  });

  return el;
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  const filter = sidebarFilter.toLowerCase();
  const list = Object.values(projects)
    .filter(
      (p) =>
        !filter ||
        (p.name || '').toLowerCase().includes(filter) ||
        (p.path || '').toLowerCase().includes(filter) ||
        (p.group || '').toLowerCase().includes(filter)
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Put ungrouped projects first, then sort named groups alphabetically.
  const groups = new Map();
  for (const p of list) {
    const g = p.group || '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }
  const orderedGroups = [...groups.entries()].sort(([ga], [gb]) => {
    if (!ga) return -1;
    if (!gb) return 1;
    return ga.localeCompare(gb);
  });

  if (!list.length && filter) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty';
    empty.textContent = '—';
    sidebar.appendChild(empty);
  }

  for (const [groupName, projs] of orderedGroups) {
    if (groupName) {
      const header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = `${groupName} (${projs.length})`;
      sidebar.appendChild(header);
    }
    for (const p of projs) {
      sidebar.appendChild(buildProjectItem(p));
    }
  }
}

// ──────────────────────────
// SELECT PROJECT
// ──────────────────────────
function selectProject(id) {
  if (!projects[id]) return;
  currentProject = id;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('project-view').style.display = 'flex';

  document.getElementById('project-title').textContent = projects[id].name;
  renderProjectStats();

  updateMeta(id);
  updateStatusBadge(projectStatus[id] || 'stopped');
  syncPortInput();
  syncCustomCommand();
  syncGroupInput();
  updateAutoStartBtn();
  updateAutoRestartBtn();
  renderLogs(id);
  refreshPortStatus(id);

  document.querySelectorAll('.project-item').forEach((el) => {
    const active = el.dataset.id === id;
    el.classList.toggle('active', active);
    const button = el.querySelector('.project-select');
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

function updateMeta(id) {
  const knownPort = projectPorts[id];
  document.getElementById('project-meta').textContent = knownPort
    ? `${projects[id]?.path || ''}  ·  http://localhost:${knownPort}`
    : projects[id]?.path || '';
}

// ──────────────────────────
// CONTROLS SYNC
// ──────────────────────────
function syncPortInput() {
  const input = document.getElementById('port-input');
  if (input && currentProject) {
    input.value = projects[currentProject]?.port ?? '';
    document.getElementById('project-open').disabled = projects[currentProject]?.port == null;
  }
}

function syncCustomCommand() {
  const command = projects[currentProject]?.customCommand;
  const row = document.getElementById('custom-command-row');
  row.hidden = !command;
  document.getElementById('custom-command-input').value = command ?? '';
  document.getElementById('custom-command-error').textContent = '';
}

function updateAutoStartBtn() {
  const btn = document.getElementById('autostart-btn');
  if (!btn) return;
  const on = !!projects[currentProject]?.autoStart;
  btn.classList.toggle('active', on);
  btn.title = on ? t('autoOn') : t('autoOff');
}

function syncGroupInput() {
  const input = document.getElementById('group-input');
  if (input && currentProject) {
    input.value = projects[currentProject]?.group ?? '';
  }
}

function updateAutoRestartBtn() {
  const btn = document.getElementById('autorestart-btn');
  if (!btn) return;
  const on = !!projects[currentProject]?.autoRestart;
  btn.classList.toggle('active', on);
  btn.title = on ? t('autoRestartOn') : t('autoRestartOff');
}

document.getElementById('port-input').addEventListener('change', (e) => {
  const custom = !!projects[currentProject]?.customCommand;
  const port = e.target.value.trim() === '' && custom ? null : Number(e.target.value);
  if (!currentProject || (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535))) {
    syncPortInput();
    return;
  }
  delete projectPorts[currentProject];
  window.api.updatePort(currentProject, port);
  refreshPortStatus(currentProject);
});

document.getElementById('custom-command-save').addEventListener('click', () => {
  if (!currentProject || !projects[currentProject]?.customCommand) return;
  const command = document.getElementById('custom-command-input').value.trim();
  const error = document.getElementById('custom-command-error');
  if (!command || command.length > 2048) return void (error.textContent = t('invalidCommand'));
  error.textContent = '';
  window.api.updateCustomCommand(currentProject, command);
});
window.api.onProjectSettingsError((message) => {
  document.getElementById('custom-command-error').textContent = message;
  syncPortInput();
});

document.getElementById('group-input').addEventListener('change', (e) => {
  if (!currentProject) return;
  window.api.updateGroup(currentProject, e.target.value.trim().slice(0, 40));
});

// Filter the sidebar by project name, path, or group as the user types.
document.getElementById('sidebar-search').addEventListener('input', (e) => {
  sidebarFilter = e.target.value.trim();
  renderSidebar();
});

// Send interactive project input to stdin when Enter is pressed.
const stdinInput = document.getElementById('stdin-input');
stdinInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const text = stdinInput.value.trim();
  if (!text || !currentProject) return;
  window.api.sendInput(currentProject, text);
  stdinInput.value = '';
});
document.getElementById('stdin-send').addEventListener('click', () => {
  const text = stdinInput.value.trim();
  if (!text || !currentProject) return;
  window.api.sendInput(currentProject, text);
  stdinInput.value = '';
});

// ──────────────────────────
// PORT STATUS — check the selected project's assigned port.
// ──────────────────────────
let portCheckSeq = 0;

async function refreshPortStatus(id) {
  const el = document.getElementById('port-status');
  if (!el || !projects[id]) return;

  const seq = ++portCheckSeq;
  if (projects[id].port == null) {
    if (currentProject !== id) return;
    el.className = 'port-status neutral';
    el.textContent = t('noPortText');
    el.title = t('noPortTitle');
    return;
  }
  const busy = await window.api.checkPort(projects[id].port);
  const status = projectStatus[id] || 'stopped';

  // Ignore a stale result if the user switched projects during the check.
  if (seq !== portCheckSeq || currentProject !== id) return;

  // A busy port on a running or booting project belongs to its own server:
  // launch was allowed only while the assigned port was free.
  if (busy && (status === 'running' || status === 'booting')) {
    el.className = 'port-status own';
    el.textContent = t('portSelfText');
    el.title = t('portSelfTitle');
    return;
  }

  el.className = 'port-status ' + (busy ? 'busy' : 'free');
  el.textContent = busy ? t('portBusyText') : t('portFreeText');
  el.title = busy ? t('portBusyTitle') : t('portFreeTitle');
}

// Refresh the port indicator every three seconds without user interaction.
setInterval(() => {
  if (currentProject) refreshPortStatus(currentProject);
}, 3000);

// ──────────────────────────
// REMOVE PROJECT
// ──────────────────────────
function removeProject(event, id) {
  event.stopPropagation();

  if (!confirm(t('confirmDelete', projectName(id)))) return;

  window.api.remove(id);

  delete projectLogs[id];
  delete projectPorts[id];
  delete projectResourceStatus[id];
  delete projectStatus[id];
  delete runningSince[id];

  if (currentProject === id) {
    currentProject = null;
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
  }
}

// ──────────────────────────
// STATUS BADGE
// ──────────────────────────
function updateStatusBadge(status) {
  const badge = document.getElementById('project-status');
  const text = document.getElementById('status-text');

  badge.className = `status-badge ${status}`;
  text.textContent = t(status) || status;
}

// ──────────────────────────
// LOGS
// ──────────────────────────
function renderLogs(id) {
  const box = document.getElementById('logs');
  box.innerHTML = '';

  const lines = projectLogs[id] || [];
  lines.forEach((item) => appendLogLine(item.type, item.message));
}

function appendLogLine(type, message) {
  const box = document.getElementById('logs');
  if (!box) return;

  message.split('\n').forEach((line) => {
    if (!line.trim()) return;
    if (logFilter && !line.toLowerCase().includes(logFilter)) return;

    const el = document.createElement('span');
    el.className = `log-line ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : type === 'system' ? 'system' : ''}`;
    el.textContent = line;
    box.appendChild(el);
    box.appendChild(document.createElement('br'));
  });

  // Bound the rendered DOM nodes; each log line uses a span and a br.
  const maxNodes = MAX_LOG_LINES * 2;
  while (box.childNodes.length > maxNodes) box.removeChild(box.firstChild);

  box.scrollTop = box.scrollHeight;
}

function clearLogs() {
  if (currentProject) {
    projectLogs[currentProject] = [];
    window.api.clearLogs(currentProject); // Also clear the persisted log.
  }
  document.getElementById('logs').innerHTML = '';
}

function exportLogs() {
  if (!currentProject) return;
  const lines = (projectLogs[currentProject] || []).map((l) => l.message);
  if (!lines.length) return;
  window.api.exportLogs(currentProject, lines.join('\n'));
}

document.getElementById('log-export').addEventListener('click', exportLogs);
document.getElementById('log-clear').addEventListener('click', clearLogs);

document.getElementById('log-search').addEventListener('input', (e) => {
  logFilter = e.target.value.trim().toLowerCase();
  if (currentProject) renderLogs(currentProject);
});

// ──────────────────────────
// KEYBOARD SHORTCUTS
// ──────────────────────────
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || !currentProject) return;

  const key = e.key.toLowerCase();
  if (key === 'r') {
    e.preventDefault();
    window.api.restart(currentProject);
  } else if (key === 'o') {
    e.preventDefault();
    openProject(currentProject);
  }
});

// ──────────────────────────
// LANGUAGE TOGGLE
// ──────────────────────────
document.getElementById('lang-btn').addEventListener('click', () => {
  lang = lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('ldm-lang', lang);
  applyLang();
});

// ──────────────────────────
// UPTIME TICKER
// ──────────────────────────
setInterval(() => {
  const el = document.getElementById('uptime');
  if (!el) return;

  const since = currentProject && runningSince[currentProject];
  if (!since) {
    el.textContent = '';
    return;
  }

  const s = Math.floor((Date.now() - since) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);

  el.textContent = `⏱ ${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s % 60)}`;
}, 1000);

// ──────────────────────────
// IPC: STATUS
// ──────────────────────────
window.api.onProjectStatus((data) => {
  projectStatus[data.id] = data.status;

  if (data.status === 'running') {
    runningSince[data.id] ??= Date.now();
  } else {
    delete runningSince[data.id];
    delete projectPorts[data.id];
  }

  const dot = document.querySelector(`.project-item[data-id="${CSS.escape(data.id)}"] .project-dot`);
  if (dot) {
    dot.className = `project-dot ${data.status}`;
  }

  if (currentProject === data.id) {
    updateStatusBadge(data.status);
    if (data.status !== 'running') {
      delete projectResourceStatus[data.id];
      renderProjectStats();
    }
    // Refresh the port indicator immediately after a status change.
    refreshPortStatus(data.id);
  }
});

// ──────────────────────────
// IPC: LOGS
// ──────────────────────────
window.api.onProjectLog((data) => {
  // Show general system messages in the currently selected project's log.
  if (data.id === '__system__') {
    if (currentProject) appendLogLine(data.type, data.message);
    return;
  }

  if (!projectLogs[data.id]) projectLogs[data.id] = [];
  projectLogs[data.id].push({ type: data.type, message: data.message });

  // Keep only the most recent log lines in memory.
  if (projectLogs[data.id].length > MAX_LOG_LINES) {
    projectLogs[data.id].splice(0, projectLogs[data.id].length - MAX_LOG_LINES);
  }

  if (currentProject === data.id) {
    appendLogLine(data.type, data.message);
  }
});

// ──────────────────────────
// IPC: PORT DETECTED
// ──────────────────────────
window.api.onProjectPort((data) => {
  projectPorts[data.id] = data.port;

  if (currentProject === data.id) {
    updateMeta(data.id);
  }
});

// ──────────────────────────
// IPC: RESOURCE STATS
// ──────────────────────────
function renderProjectStats() {
  const el = document.getElementById('project-stats');
  if (!el) return;
  const data = currentProject && projectResourceStatus[currentProject];
  el.textContent = !data
    ? ''
    : data.available === false
      ? t('statsUnavailable')
      : `CPU ${data.cpu.toFixed(1)}% · RAM ${(data.memory / 1048576).toFixed(0)} MB`;
}

window.api.onProjectStats((data) => {
  projectResourceStatus[data.id] = data;
  if (currentProject === data.id) renderProjectStats();
});

// ──────────────────────────
// IPC: PROJECTS DATA
// ──────────────────────────
window.api.onProjectsData((data) => {
  const prevIds = new Set(Object.keys(projects));
  projects = data;
  if (addDialog.open && addSelection && Object.values(projects).some((project) => project.path === addSelection.path))
    addDialog.close();
  renderSidebar();

  // The selected project was removed.
  if (currentProject && !projects[currentProject]) {
    currentProject = null;
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
  }

  // Select a newly added project, but not during the initial load.
  const added = Object.keys(projects).find((id) => !prevIds.has(id));
  if (added && prevIds.size > 0) {
    selectProject(added);
    return;
  }

  // Select the first project when nothing is selected yet.
  if (!currentProject) {
    const first = Object.keys(projects)[0];
    if (first) selectProject(first);
    return;
  }

  // Sync controls after project settings change.
  updateMeta(currentProject);
  syncPortInput();
  syncCustomCommand();
  syncGroupInput();
  updateAutoStartBtn();
  updateAutoRestartBtn();
  refreshPortStatus(currentProject);
});

// ──────────────────────────
// IPC: LOGS HISTORY
// Merge persisted logs from earlier sessions, then render the selected log.
// ──────────────────────────
window.api.onLogsData((data) => {
  for (const [id, entries] of Object.entries(data || {})) {
    if (!Array.isArray(entries)) continue;
    projectLogs[id] = entries.slice(-MAX_LOG_LINES).map((e) => ({ type: e.type, message: e.message }));
  }
  if (currentProject) renderLogs(currentProject);
});

// ──────────────────────────
// INIT
// ──────────────────────────
applyLang();
