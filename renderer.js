// ──────────────────────────
// I18N
// ──────────────────────────
const I18N = {
  ar: {
    projects: 'المشاريع',
    addProject: 'إضافة مشروع',
    emptyState: 'اختر مشروعًا أو أضف مشروعًا جديدًا',
    start: 'تشغيل',
    stop: 'إيقاف',
    restart: 'إعادة تشغيل',
    open: 'فتح',
    folder: 'مجلد',
    auto: 'تلقائي',
    consoleOutput: 'Console Output',
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
    stdinSend: 'إرسال'
  },
  en: {
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
    stdinSend: 'Send'
  }
};

let lang = localStorage.getItem('ldm-lang') || 'en'; // الإنجليزية افتراضية

function t(key, ...args) {
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // إبلاغ العملية الرئيسية حتى تترجم رسائل اللوقز وقائمة الصينية
  window.api.setLanguage(lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });

  document.getElementById('lang-btn').textContent = t('langBtn');
  updateStatusBadge(currentProject ? (projectStatus[currentProject] || 'stopped') : 'stopped');
  updateAutoStartBtn();
  updateAutoRestartBtn();
}

// ──────────────────────────
// STATE
// ──────────────────────────
let currentProject = null;
let projects       = {};
let projectStatus  = {};
let projectLogs    = {}; // logs per project
let projectPorts   = {}; // ports per project
let runningSince   = {}; // بدء التشغيل لكل مشروع
let logFilter      = '';
let sidebarFilter  = '';   // بحث القائمة الجانبية
let draggedId      = null;  // المشروع المسحوب حاليًا في القائمة

const MAX_LOG_LINES = 500;

// ──────────────────────────
// HELPERS
// ──────────────────────────
function projectName(id) {
  return projects[id]?.name || id;
}

function openProject(id) {
  const resolvedPort = projectPorts[id] || projects[id]?.port;
  window.api.open(id, resolvedPort);
}

// ──────────────────────────
// SIDEBAR
// بناء بالعناصر بدل innerHTML — أسماء المجلدات مدخل غير موثوق
// بحث فوري + تجميع حسب المجموعة + سحب وإفلات للترتيب
// ──────────────────────────
function buildProjectItem(p) {
  const el = document.createElement('div');
  el.className = 'project-item' + (p.id === currentProject ? ' active' : '');
  el.dataset.id = p.id;
  el.title = p.path;
  el.draggable = true;

  const dot = document.createElement('span');
  dot.className = `project-dot ${projectStatus[p.id] || 'stopped'}`;

  const name = document.createElement('span');
  name.className = 'project-name';
  name.textContent = p.name;

  const del = document.createElement('button');
  del.className = 'project-delete';
  del.title = t('deleteTitle');
  del.textContent = '✕';
  del.addEventListener('click', (e) => removeProject(e, p.id));

  el.append(dot, name, del);
  el.addEventListener('click', () => selectProject(p.id));

  // سحب وإفلات لترتيب المشاريع
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
      .map(x => x.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(p.id);
    if (from === -1 || to === -1) return;

    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);

    // تحديث محلي فوري ثم حفظ في النواة
    ids.forEach((id, i) => { if (projects[id]) projects[id].order = i; });
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
    .filter(p => !filter ||
      (p.name || '').toLowerCase().includes(filter) ||
      (p.path || '').toLowerCase().includes(filter) ||
      (p.group || '').toLowerCase().includes(filter))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // تجميع حسب المجموعة — "بدون مجموعة" أولاً ثم أبجديًا
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
  document.getElementById('project-stats').textContent = '';

  updateMeta(id);
  updateStatusBadge(projectStatus[id] || 'stopped');
  syncPortInput();
  syncGroupInput();
  updateAutoStartBtn();
  updateAutoRestartBtn();
  renderLogs(id);
  refreshPortStatus(id);

  document.querySelectorAll('.project-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
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
  }
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
  const port = parseInt(e.target.value, 10);
  if (!currentProject || !Number.isInteger(port) || port < 1 || port > 65535) {
    syncPortInput();
    return;
  }
  window.api.updatePort(currentProject, port);
  refreshPortStatus(currentProject);
});

document.getElementById('group-input').addEventListener('change', (e) => {
  if (!currentProject) return;
  window.api.updateGroup(currentProject, e.target.value.trim().slice(0, 40));
});

// بحث القائمة الجانبية — فلترة فورية بالاسم أو المسار أو المجموعة
document.getElementById('sidebar-search').addEventListener('input', (e) => {
  sidebarFilter = e.target.value.trim();
  renderSidebar();
});

// إدخال تفاعلي للمشروع (stdin) — Enter يرسل السطر
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
// PORT STATUS — تنبيه فوري عند اختيار المشروع إذا كان بورت 3000 مشغولاً
// ──────────────────────────
let portCheckSeq = 0;

async function refreshPortStatus(id) {
  const el = document.getElementById('port-status');
  if (!el || !projects[id]) return;

  const seq = ++portCheckSeq;
  const busy = await window.api.checkPort(projects[id].port);
  const status = projectStatus[id] || 'stopped';

  // تجاهل نتيجة قديمة إذا بدّل المستخدم المشروع سريعًا
  if (seq !== portCheckSeq || currentProject !== id) return;

  // المؤشر الواعي بالسياق: البورت مشغول والمشروع يعمل أو يُقلع = خادم المشروع نفسه
  // (التشغيل لا يُسمح به أصلًا إلا إذا كان البورت حرًا وقتها — فالمشغول الآن خادمنا)
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

// تحديث دوري للمؤشر كل 3 ثوانٍ — يبقى حيًا دائمًا دون أي تفاعل
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
  const text  = document.getElementById('status-text');

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
  lines.forEach(item => appendLogLine(item.type, item.message));
}

function appendLogLine(type, message) {
  const box = document.getElementById('logs');
  if (!box) return;

  message.split('\n').forEach(line => {
    if (!line.trim()) return;
    if (logFilter && !line.toLowerCase().includes(logFilter)) return;

    const el = document.createElement('span');
    el.className = `log-line ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : type === 'system' ? 'system' : ''}`;
    el.textContent = line;
    box.appendChild(el);
    box.appendChild(document.createElement('br'));
  });

  // حد أقصى لعقد DOM المعروضة (كل سطر = span + br)
  const maxNodes = MAX_LOG_LINES * 2;
  while (box.childNodes.length > maxNodes) box.removeChild(box.firstChild);

  box.scrollTop = box.scrollHeight;
}

function clearLogs() {
  if (currentProject) {
    projectLogs[currentProject] = [];
    window.api.clearLogs(currentProject); // مسح من القرص أيضًا
  }
  document.getElementById('logs').innerHTML = '';
}

function exportLogs() {
  if (!currentProject) return;
  const lines = (projectLogs[currentProject] || []).map(l => l.message);
  if (!lines.length) return;
  window.api.exportLogs(currentProject, lines.join('\n'));
}

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
  if (!since) { el.textContent = ''; return; }

  const s = Math.floor((Date.now() - since) / 1000);
  const pad = n => String(n).padStart(2, '0');
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
  }

  const dot = document.querySelector(`.project-item[data-id="${CSS.escape(data.id)}"] .project-dot`);
  if (dot) {
    dot.className = `project-dot ${data.status}`;
  }

  if (currentProject === data.id) {
    updateStatusBadge(data.status);
    if (data.status !== 'running') {
      document.getElementById('project-stats').textContent = '';
    }
    // المؤشر يتحدث فورًا مع كل تغير حالة (تشغيل/إيقاف)
    refreshPortStatus(data.id);
  }
});

// ──────────────────────────
// IPC: LOGS
// ──────────────────────────
window.api.onProjectLog((data) => {
  // رسائل النظام العامة (إضافة فاشلة، تحذيرات...) تُعرض في المشروع المفتوح حاليًا
  if (data.id === '__system__') {
    if (currentProject) appendLogLine(data.type, data.message);
    return;
  }

  if (!projectLogs[data.id]) projectLogs[data.id] = [];
  projectLogs[data.id].push({ type: data.type, message: data.message });

  // حد أقصى للوقز المحفوظ في الذاكرة
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

  // أخبر main.js بالبورت عشان يستخدمه في زر فتح
  window.api.savePort(data.id, data.port);

  if (currentProject === data.id) {
    updateMeta(data.id);
  }
});

// ──────────────────────────
// IPC: RESOURCE STATS
// ──────────────────────────
window.api.onProjectStats((data) => {
  if (currentProject !== data.id) return;

  const el = document.getElementById('project-stats');
  if (el) {
    el.textContent = `CPU ${data.cpu.toFixed(1)}% · RAM ${(data.memory / 1048576).toFixed(0)} MB`;
  }
});

// ──────────────────────────
// IPC: PROJECTS DATA
// ──────────────────────────
window.api.onProjectsData((data) => {
  const prevIds = new Set(Object.keys(projects));
  projects = data;
  renderSidebar();

  // المشروع المحدد حُذف
  if (currentProject && !projects[currentProject]) {
    currentProject = null;
    document.getElementById('project-view').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
  }

  // مشروع أُضيف للتو (وليس التحميل الأول) → حدّده مباشرة
  const added = Object.keys(projects).find(id => !prevIds.has(id));
  if (added && prevIds.size > 0) {
    selectProject(added);
    return;
  }

  // تحديد أول مشروع تلقائيًا إذا لم يكن هناك اختيار
  if (!currentProject) {
    const first = Object.keys(projects)[0];
    if (first) selectProject(first);
    return;
  }

  // مزامنة عناصر التحكم بعد أي تحديث (بورت، تشغيل تلقائي...)
  updateMeta(currentProject);
  syncPortInput();
  syncGroupInput();
  updateAutoStartBtn();
  updateAutoRestartBtn();
  refreshPortStatus(currentProject);
});

// ──────────────────────────
// IPC: LOGS HISTORY
// السجلات المحفوظة على القرص من الجلسات السابقة — تُدمج ثم يُعاد العرض
// ──────────────────────────
window.api.onLogsData((data) => {
  for (const [id, entries] of Object.entries(data || {})) {
    if (!Array.isArray(entries)) continue;
    projectLogs[id] = entries.slice(-MAX_LOG_LINES).map(e => ({ type: e.type, message: e.message }));
  }
  if (currentProject) renderLogs(currentProject);
});

// ──────────────────────────
// INIT
// ──────────────────────────
applyLang();
