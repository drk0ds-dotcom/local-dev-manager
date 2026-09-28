const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');

const {
  startProject,
  stopProject,
  restartProject,
  stopAllProjects,
  hasRunningProcesses,
  getStatus,
  getRunningPids,
  findFreePort,
  isPortInUse,
  setUiLanguage,
  writeStdin,
  setLogSink
} = require('./processManager');
const { startProjectWithChecks } = require('./projectStarter');

// مراقبة الموارد — اختيارية: لو الحزمة غير مثبتة يتعطل العرض بصمت
let pidusage = null;
try { pidusage = require('pidusage'); } catch {}

let win;
let projects = {};

// حفظ البورتات المكتشفة ديناميكيًا
let detectedPorts = {};

// نتيجة فحص البيئة — تُحدَّث قبل إنشاء النافذة
let npmAvailable = true;

// projects.json يُخزَّن في userData — __dirname يصبح للقراءة فقط بعد التحزيم
const projectsPath = (() => {
  const newPath = path.join(app.getPath('userData'), 'projects.json');
  const legacyPath = path.join(__dirname, 'projects.json');

  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    try {
      fs.copyFileSync(legacyPath, newPath);
      console.log('📦 تم نقل projects.json إلى:', newPath);
    } catch (err) {
      console.error('⚠️ فشل نقل projects.json — سنستخدم المسار القديم:', err.message);
      return legacyPath;
    }
  }
  return newPath;
})();

// ======================
// LOAD PROJECTS
// ======================
function loadProjects() {
  try {
    if (!fs.existsSync(projectsPath)) {
      fs.writeFileSync(projectsPath, JSON.stringify({}, null, 2));
    }
    const data = fs.readFileSync(projectsPath, 'utf-8');
    const parsed = JSON.parse(data);

    projects = {};
    let migrated = false;
    let index = 0;

    for (const [key, val] of Object.entries(parsed)) {
      if (!val || !val.path) continue;

      // ترحيل من الصيغة القديمة: المفتاح كان اسم المجلد وبدون id —
      // مجلدان بنفس الاسم كانا يتصادمان
      const id = (typeof val.id === 'string' && val.id) || crypto.randomUUID();
      if (!val.id) migrated = true;

      projects[id] = {
        id,
        name: (typeof val.name === 'string' && val.name) ? val.name : key,
        path: val.path,
        port: Number.isInteger(val.port) ? val.port : 3000,
        autoStart: !!val.autoStart,
        autoRestart: !!val.autoRestart,
        group: typeof val.group === 'string' ? val.group : '',
        order: Number.isInteger(val.order) ? val.order : index,
        script: val.script === 'start' ? 'start' : 'dev'
      };
      index++;
    }

    if (migrated) saveProjects();
    console.log("✅ Projects loaded:", Object.values(projects).map(p => p.name));
  } catch (err) {
    console.error("❌ Failed to load projects.json:", err.message);
    projects = {};
  }
}

function saveProjects() {
  fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
}

function startManagedProject(id) {
  if (!isKnownId(id)) return Promise.resolve('unknown-project');

  return startProjectWithChecks({
    id,
    project: projects[id],
    npmAvailable,
    status: getStatus(id),
    win,
    isPortInUse,
    startProject,
    sendLog,
    npmUnavailableMessage: msg('npmUnavailable'),
    portBusyMessage: (port) => msg('portBusy', port)
  });
}

loadProjects();

// ======================
// I18N — رسائل العملية الرئيسية تتبع لغة الواجهة (الإنجليزية افتراضية)
// ======================
let uiLang = 'en';

const MSG = {
  en: {
    alreadyExists: (n) => `⚠️ Project "${n}" already exists`,
    notNodeProject: '❌ This folder is not a Node project (no package.json)',
    invalidPackageJson: '❌ package.json is corrupted or invalid',
    noDevStart: (n) => `❌ No dev or start script in package.json of project "${n}"`,
    addedProject: (n, s, p) => `✅ Project "${n}" added (script: ${s}, port: ${p})`,
    portClash: (p, n) => `⚠️ Port ${p} is assigned to project "${n}"`,
    portChanged: (p) => `🔧 Port changed to ${p} — will be used on next start`,
    npmUnavailable: '❌ npm unavailable — install Node.js and restart the app',
    openInCodeFailed: '⚠️ Could not open VS Code — make sure it is installed and the code command is in PATH',
    logsExported: (p) => `💾 Logs exported to: ${p}`,
    logsExportFailed: (e) => `❌ Failed to export logs: ${e}`,
    portBusy: (p) => `❌ Port ${p} is in use by another process — change the port or free it first`,
    stdinNotRunning: '⚠️ Project is not running — input was not sent',
    chooseFolder: 'Choose project folder',
    exportLogsTitle: 'Export logs',
    envErrorTitle: 'Incomplete environment',
    envErrorMessage: 'npm was not found in PATH.\nInstall Node.js from nodejs.org, then restart the app.',
    trayShow: 'Show window',
    trayStopAll: 'Stop all projects',
    trayQuit: 'Quit',
    updateDownloadedTitle: 'Update ready',
    updateDownloadedMsg: 'A new version was downloaded. Restart now to install it?',
    restartNow: 'Restart now',
    later: 'Later'
  },
  ar: {
    alreadyExists: (n) => `⚠️ المشروع "${n}" موجود بالفعل`,
    notNodeProject: '❌ هذا المجلد ليس مشروع Node (لا يوجد package.json)',
    invalidPackageJson: '❌ package.json تالف أو غير صالح',
    noDevStart: (n) => `❌ لا يوجد سكريبت dev أو start في package.json للمشروع "${n}"`,
    addedProject: (n, s, p) => `✅ تم إضافة المشروع "${n}" (script: ${s}, port: ${p})`,
    portClash: (p, n) => `⚠️ البورت ${p} مخصص للمشروع "${n}"`,
    portChanged: (p) => `🔧 تم تغيير البورت إلى ${p} — سيُستخدم عند التشغيل القادم`,
    npmUnavailable: '❌ npm غير متاح — ثبّت Node.js وأعد تشغيل التطبيق',
    openInCodeFailed: '⚠️ تعذر فتح VS Code — تأكد من تثبيته وتوفر الأمر code في PATH',
    logsExported: (p) => `💾 تم تصدير السجلات إلى: ${p}`,
    logsExportFailed: (e) => `❌ فشل تصدير السجلات: ${e}`,
    portBusy: (p) => `❌ البورت ${p} مشغول بعملية أخرى — غيّر البورت أو حرّره أولاً`,
    stdinNotRunning: '⚠️ المشروع ليس قيد التشغيل — لم يُرسل الإدخال',
    chooseFolder: 'اختر مجلد المشروع',
    exportLogsTitle: 'تصدير السجلات',
    envErrorTitle: 'بيئة العمل غير مكتملة',
    envErrorMessage: 'لم يتم العثور على npm في PATH.\nثبّت Node.js من nodejs.org ثم أعد تشغيل التطبيق.',
    trayShow: 'إظهار النافذة',
    trayStopAll: 'إيقاف كل المشاريع',
    trayQuit: 'إنهاء',
    updateDownloadedTitle: 'التحديث جاهز',
    updateDownloadedMsg: 'تم تحميل نسخة جديدة. أعد التشغيل الآن لتثبيتها؟',
    restartNow: 'إعادة التشغيل الآن',
    later: 'لاحقًا'
  }
};

function msg(key, ...args) {
  const v = (MSG[uiLang] || MSG.en)[key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

// ======================
// LOG PERSISTENCE
// كل سطر يُلحق بملف userData/logs/<id>.log — يعود بعد إعادة تشغيل التطبيق
// ======================
const logsDir = path.join(app.getPath('userData'), 'logs');
const logsHistory = {};   // id -> [{type, message}] — آخر 500 سطر لكل مشروع
const logsFileLines = {}; // عداد أسطر الملف لكل مشروع (لضغط الملف دورياً)
const LOG_CAP = 500;

function loadLogsFromDisk() {
  try {
    if (!fs.existsSync(logsDir)) return;
    for (const file of fs.readdirSync(logsDir)) {
      if (!file.endsWith('.log')) continue;
      const id = file.slice(0, -4);
      const raw = fs.readFileSync(path.join(logsDir, file), 'utf-8');
      const entries = raw.split('\n')
        .filter(Boolean)
        .slice(-LOG_CAP)
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(e => e && typeof e.type === 'string' && typeof e.message === 'string');
      logsHistory[id] = entries;
      logsFileLines[id] = entries.length;
    }
    console.log('📄 Logs restored for:', Object.keys(logsHistory).length, 'project(s)');
  } catch (err) {
    console.error('⚠️ Failed to load logs from disk:', err.message);
  }
}

function appendLogToDisk(id, entry) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    const filePath = path.join(logsDir, `${id}.log`);
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');

    // ضغط دوري: عند تجاوز ضعف الحد يُعاد كتابة آخر LOG_CAP سطر فقط
    logsFileLines[id] = (logsFileLines[id] || 0) + 1;
    if (logsFileLines[id] >= LOG_CAP * 2) {
      const kept = (logsHistory[id] || []).slice(-LOG_CAP);
      fs.writeFileSync(filePath, kept.map(e => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''), 'utf-8');
      logsFileLines[id] = kept.length;
    }
  } catch (err) {
    console.error('⚠️ Failed to persist log line:', err.message);
  }
}

// نقطة واحدة لإرسال اللوق + حفظه على القرص
function sendLog(id, type, message) {
  if (id !== '__system__') {
    if (!logsHistory[id]) logsHistory[id] = [];
    logsHistory[id].push({ type, message });
    if (logsHistory[id].length > LOG_CAP) logsHistory[id].shift();
    appendLogToDisk(id, { type, message });
  }
  win?.webContents.send('project-log', { id, type, message });
}

// حقن sendLog في مدير العمليات — مخرجات السيرفرات تمر بنفس النقطة فتُحفظ أيضًا
setLogSink((id, type, message) => sendLog(id, type, message));

loadLogsFromDisk();

// ======================
// VALIDATION
// ======================
const isKnownId = (id) => typeof id === 'string' && !!projects[id];
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

  // إزالة القائمة الافتراضية لامتلاك اختصارات مثل Ctrl+R داخل الواجهة
  win.setMenu(null);

  // الإغلاق يُصغّر للصينية — الخروج الحقيقي فقط من قائمة الصينية
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('projects-data', projects);
    win.webContents.send('logs-data', logsHistory);

    // تشغيل تلقائي للمشاريع المفعّلة
    for (const p of Object.values(projects)) {
      if (p.autoStart) startManagedProject(p.id);
    }
  });
}

// ======================
// SYSTEM TRAY
// ======================
let tray = null;

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: msg('trayShow'), click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: msg('trayStopAll'), click: () => stopAllProjects() },
    { type: 'separator' },
    // إصلاح P3-D: لا نضع isQuitting هنا — قبل-quit هو المسؤول الوحيد عن التنظيف
    { label: msg('trayQuit'), click: () => app.quit() }
  ]);
}

// إعادة بناء قائمة الصينية بعد تبديل اللغة
function rebuildTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  let icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  if (icon.isEmpty()) {
    console.error('⚠️ Failed to load tray icon');
    return;
  }
  icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Local Dev Manager');
  rebuildTrayMenu();
  tray.on('click', () => { win?.show(); win?.focus(); });

  console.log('✅ TRAY READY');
}

// ======================
// RESOURCE MONITORING
// ======================
async function pollStats() {
  if (!pidusage || !win || win.isDestroyed()) return;

  const entries = Object.entries(getRunningPids());
  if (!entries.length) return;

  for (const [id, pid] of entries) {
    try {
      // نجمع شجرة العملية كاملة (npm → node → السيرفر الفعلي)
      const tree = await pidusage.tree(pid);
      let cpu = 0, memory = 0;
      for (const s of Object.values(tree)) {
        cpu += s.cpu;
        memory += s.memory;
      }
      win.webContents.send('project-stats', { id, cpu, memory });
    } catch {
      // العملية ماتت بين الاستعلامين — تجاهل
    }
  }
}

setInterval(pollStats, 3000);

// ======================
// AUTO UPDATE (electron-updater)
// يعمل فقط في النسخة المثبّتة — في وضع التطوير لا يُحمَّل إطلاقًا
// يتصل بـ GitHub Releases (إعداد publish في package.json)
// ======================
let autoUpdater = null;

if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
      console.log('⬆️ Update available — downloading...');
    });
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(win, {
        type: 'info',
        title: msg('updateDownloadedTitle'),
        message: msg('updateDownloadedMsg'),
        buttons: [msg('restartNow'), msg('later')],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) autoUpdater?.quitAndInstall();
      });
    });
    autoUpdater.on('error', (err) => {
      console.error('⚠️ Update error:', err.message);
    });
  } catch (err) {
    console.error('⚠️ Failed to init auto-updater:', err.message);
  }
}

function checkForUpdates() {
  if (!autoUpdater) return;
  autoUpdater.checkForUpdates().catch(() => {});
}

// ======================
// SINGLE INSTANCE LOCK
// نسخة ثانية من التطبيق تُغلق فورًا وتعيد تركيز النافذة الموجودة —
// يمنع سباق الكتابة على projects.json وقتل عمليات نسخة أخرى عند الخروج
// ======================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // فحص البيئة قبل إنشاء النافذة حتى تُحترم نتيجته في التشغيل التلقائي
    exec('npm --version', { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      npmAvailable = !err;
      if (err) {
        console.error('❌ npm not found in PATH');
      } else {
        console.log('✅ npm', stdout.trim());
      }

      createWindow();
      createTray();

      // التحديث التلقائي: فحص عند الإقلاع ثم كل 12 ساعة
      checkForUpdates();
      setInterval(checkForUpdates, 12 * 60 * 60 * 1000);

      if (err) {
        dialog.showErrorBox(msg('envErrorTitle'), msg('envErrorMessage'));
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ======================
// قتل كل العمليات الفرعية قبل الخروج
// ======================
let isQuitting = false;   // طُلب خروج حقيقي — النافذة تُغلق ولا تُخفى للصينية
let cleanupDone = false;  // تم تنفيذ قتل العمليات بالفعل

app.on('before-quit', (event) => {
  // أي طلب خروج (من الصينية أو النظام): النافذة تُغلق فعليًا ولا تُخفى
  isQuitting = true;

  if (cleanupDone || !hasRunningProcesses()) return;

  event.preventDefault();
  cleanupDone = true;

  stopAllProjects().finally(() => app.quit());
});

// ======================
// WINDOW CONTROLS
// ======================
ipcMain.on('app-close',    () => win.close());
ipcMain.on('app-minimize', () => win.minimize());
ipcMain.on('app-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());

// ======================
// ADD PROJECT
// ======================
ipcMain.on('add-project', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: msg('chooseFolder')
  });

  if (result.canceled) return;

  const folderPath = result.filePaths[0];
  const projectName = path.basename(folderPath);

  // منع التكرار بالمسار — مجلدان مختلفان بنفس الاسم مسموح بهما
  if (Object.values(projects).some(p => p.path === folderPath)) {
    sendLog('__system__', 'warn', msg('alreadyExists', projectName));
    return;
  }

  const packagePath = path.join(folderPath, 'package.json');

  if (!fs.existsSync(packagePath)) {
    sendLog('__system__', 'error', msg('notNodeProject'));
    return;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  } catch (e) {
    sendLog('__system__', 'error', msg('invalidPackageJson'));
    return;
  }

  const hasDev = !!packageJson.scripts?.dev;
  const hasStart = !!packageJson.scripts?.start;

  if (!hasDev && !hasStart) {
    sendLog('__system__', 'error', msg('noDevStart', projectName));
    return;
  }

  // بورت حر: لا محجوز في سجل التطبيق ولا مشغول في النظام
  const reservedPorts = Object.values(projects).map(p => p.port);
  const port = await findFreePort(3000, reservedPorts);

  const id = crypto.randomUUID();
  projects[id] = {
    id,
    name: projectName,
    path: folderPath,
    port,
    autoStart: false,
    autoRestart: false,
    group: '',
    order: Object.keys(projects).length,
    script: hasDev ? 'dev' : 'start'
  };

  saveProjects();
  win.webContents.send('projects-data', projects);

  sendLog(id, 'log', msg('addedProject', projectName, projects[id].script, port));
});

// ======================
// REMOVE PROJECT
// ======================
ipcMain.on('remove-project', (event, id) => {
  if (!isKnownId(id)) return;

  // إيقاف فقط إن كان شغالًا فعلًا — حذف مشروع متوقف لا يحتاج رسالة تحذير
  if (getStatus(id) !== 'stopped') {
    stopProject(id, projects[id], win);
  }

  delete projects[id];
  delete detectedPorts[id];
  saveProjects();

  // حذف سجل اللوقز المحفوظ على القرص مع المشروع
  delete logsHistory[id];
  delete logsFileLines[id];
  try {
    const logFile = path.join(logsDir, `${id}.log`);
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  } catch {}

  win.webContents.send('projects-data', projects);
});

// ======================
// UPDATE PORT
// ======================
ipcMain.on('update-port', (event, payload) => {
  if (!isKnownId(payload?.id) || !isValidPort(payload?.port)) return;

  const id = payload.id;
  const clash = Object.values(projects).find(p => p.id !== id && p.port === payload.port);
  if (clash) {
    sendLog(id, 'warn', msg('portClash', payload.port, clash.name));
    win.webContents.send('projects-data', projects); // مزامنة الحقل مع القيمة المحفوظة
    return;
  }

  projects[id].port = payload.port;
  saveProjects();
  win.webContents.send('projects-data', projects);

  sendLog(id, 'system', msg('portChanged', payload.port));
});

// ======================
// TOGGLE AUTOSTART
// ======================
ipcMain.on('toggle-autostart', (event, id) => {
  if (!isKnownId(id)) return;

  projects[id].autoStart = !projects[id].autoStart;
  saveProjects();
  win.webContents.send('projects-data', projects);
});

// ======================
// TOGGLE AUTO-RESTART ON CRASH
// ======================
ipcMain.on('toggle-autorestart', (event, id) => {
  if (!isKnownId(id)) return;

  projects[id].autoRestart = !projects[id].autoRestart;
  saveProjects();
  win.webContents.send('projects-data', projects);
});

// ======================
// UPDATE GROUP
// ======================
ipcMain.on('update-group', (event, payload) => {
  if (!isKnownId(payload?.id)) return;

  const group = typeof payload?.group === 'string' ? payload.group.trim().slice(0, 40) : '';
  projects[payload.id].group = group;
  saveProjects();
  win.webContents.send('projects-data', projects);
});

// ======================
// REORDER PROJECTS
// يصل من السحب والإفلات في القائمة الجانبية
// ======================
ipcMain.on('reorder-projects', (event, orderedIds) => {
  if (!Array.isArray(orderedIds)) return;

  const known = new Set(Object.keys(projects));
  orderedIds.filter(id => known.has(id)).forEach((id, i) => {
    projects[id].order = i;
  });
  saveProjects();
  win.webContents.send('projects-data', projects);
});

// ======================
// SEND INPUT TO PROJECT STDIN
// إدخال تفاعلي للمشاريع التي تطرح أسئلة أثناء التشغيل
// ======================
ipcMain.on('send-input', (event, payload) => {
  if (!isKnownId(payload?.id) || typeof payload?.text !== 'string') return;

  const text = payload.text.slice(0, 2000);
  if (!writeStdin(payload.id, text)) {
    sendLog(payload.id, 'warn', msg('stdinNotRunning'));
  }
});

// ======================
// START
// ======================
ipcMain.on('start', async (event, id) => {
  await startManagedProject(id);
});

// ======================
// STOP
// ======================
ipcMain.on('stop', (event, id) => {
  if (!isKnownId(id)) return;
  stopProject(id, projects[id], win);
});

// ======================
// RESTART
// ======================
ipcMain.on('restart', (event, id) => {
  if (!isKnownId(id)) return;

  if (!npmAvailable) {
    sendLog(id, 'error', msg('npmUnavailable'));
    return;
  }

  restartProject(id, projects[id], win);
});

// ======================
// OPEN IN BROWSER
// ======================
ipcMain.on('open', (event, payload) => {
  if (!isKnownId(payload?.id)) return;

  const id = payload.id;
  let p = detectedPorts[id];
  if (!isValidPort(p)) {
    p = isValidPort(payload?.port) ? payload.port : projects[id].port;
  }
  if (!isValidPort(p)) return;

  shell.openExternal(`http://localhost:${p}`);
});

// ======================
// OPEN FOLDER IN EXPLORER
// ======================
ipcMain.on('open-folder', (event, id) => {
  if (!isKnownId(id)) return;
  shell.openPath(projects[id].path);
});

// ======================
// OPEN IN VS CODE
// ======================
ipcMain.on('open-in-code', (event, id) => {
  if (!isKnownId(id)) return;

  const safePath = projects[id].path.replace(/"/g, '\\"');
  exec(`code "${safePath}"`, { windowsHide: true }, (err) => {
    if (err) {
      sendLog(id, 'warn', msg('openInCodeFailed'));
    }
  });
});

// ======================
// البورت يُخزَّن عبر ipcMain من renderer
// ======================
ipcMain.on('save-port', (event, payload) => {
  if (!isKnownId(payload?.id) || !isValidPort(payload?.port)) return;
  detectedPorts[payload.id] = payload.port;
});

// ======================
// EXPORT LOGS
// ======================
ipcMain.on('export-logs', async (event, payload) => {
  if (!isKnownId(payload?.id) || typeof payload?.content !== 'string') return;
  if (payload.content.length > 5_000_000) return;

  const id = payload.id;
  const result = await dialog.showSaveDialog(win, {
    title: msg('exportLogsTitle'),
    defaultPath: `${projects[id].name}-logs.txt`,
    filters: [{ name: 'Text', extensions: ['txt'] }]
  });

  if (result.canceled || !result.filePath) return;

  try {
    fs.writeFileSync(result.filePath, payload.content, 'utf-8');
    sendLog(id, 'system', msg('logsExported', result.filePath));
  } catch (err) {
    sendLog(id, 'error', msg('logsExportFailed', err.message));
  }
});

// ======================
// SET UI LANGUAGE
// تصل من الواجهة عند الإقلاع وعند كل تبديل — رسائل النواة تتبعها
// ======================
ipcMain.on('set-language', (event, lang) => {
  if (lang !== 'en' && lang !== 'ar') return;
  uiLang = lang;
  setUiLanguage(lang);
  // إعادة بناء قائمة الصينية بلغتها الصحيحة
  rebuildTrayMenu();
});

// ======================
// CHECK PORT (للتنبيه عند اختيار المشروع)
// ======================
ipcMain.handle('check-port', async (event, port) => {
  if (!isValidPort(port)) return true; // قيمة فاسدة تُعامل كمشغول
  return isPortInUse(port);
});

// ======================
// CLEAR LOGS — مسح من الذاكرة ومن القرص معًا
// ======================
ipcMain.on('clear-logs', (event, id) => {
  if (!isKnownId(id)) return;
  logsHistory[id] = [];
  logsFileLines[id] = 0;
  try {
    fs.writeFileSync(path.join(logsDir, `${id}.log`), '', 'utf-8');
  } catch {}
});
