console.log("✅ PROCESS MANAGER LOADED");

const { exec } = require('child_process');
const spawn = require('cross-spawn');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { createRestartPolicy } = require('./restartPolicy');

let processes = {};
let processStatus = {};

// عمليات أوقفناها عمدًا — نتجاهل أحداث close اللاحقة لها
const killedIds = new Set();

// سياسة محاولات إعادة التشغيل التلقائي لكل مشروع
const restartPolicy = createRestartPolicy();

// ======================
// I18N — رسائل مدير العمليات تتبع لغة الواجهة (الإنجليزية افتراضية)
// ======================
let pmLang = 'en';

function setUiLanguage(lang) {
  if (lang === 'ar' || lang === 'en') pmLang = lang;
}

const PMMSG = {
  en: {
    alreadyRunning: (name) => `⚠️ Project "${name}" is already running`,
    installing: (pm) => `📦 node_modules missing — running ${pm} install automatically...`,
    installFailed: (pm, code) => `❌ ${pm} install failed (exit code: ${code})`,
    installDone: (pm) => `✅ ${pm} install completed — starting the project...`,
    installError: (pm, err) => `❌ ${pm} install error: ${err}`,
    notRunning: (name) => `⚠️ Project "${name}" is not running`,
    restarting: (name) => `🔄 Restarting "${name}"...`,
    stoppedByUser: (name) => `🔴 Project "${name}" stopped`,
    stoppedUnexpectedly: (code) => `🔴 Project stopped (exit code: ${code})`,
    launchError: (err) => `❌ Failed to start the project: ${err}`,
    autoRestarting: (name) => `🔄 Project "${name}" crashed — auto-restarting...`,
    autoRestartGaveUp: (name) => `❌ Project "${name}" keeps crashing — auto-restart disabled`
  },
  ar: {
    alreadyRunning: (name) => `⚠️ المشروع "${name}" يعمل بالفعل`,
    installing: (pm) => `📦 node_modules غير موجود — جاري تشغيل ${pm} install تلقائياً...`,
    installFailed: (pm, code) => `❌ فشل ${pm} install (exit code: ${code})`,
    installDone: (pm) => `✅ ${pm} install اكتمل — جاري تشغيل المشروع...`,
    installError: (pm, err) => `❌ خطأ في ${pm} install: ${err}`,
    notRunning: (name) => `⚠️ المشروع "${name}" ليس قيد التشغيل`,
    restarting: (name) => `🔄 جاري إعادة تشغيل "${name}"...`,
    stoppedByUser: (name) => `🔴 تم إيقاف المشروع "${name}"`,
    stoppedUnexpectedly: (code) => `🔴 المشروع توقف (exit code: ${code})`,
    launchError: (err) => `❌ خطأ في تشغيل المشروع: ${err}`,
    autoRestarting: (name) => `🔄 انهار المشروع "${name}" — جاري إعادة التشغيل تلقائياً...`,
    autoRestartGaveUp: (name) => `❌ المشروع "${name}" ينهار بشكل متكرر — أُوقف الإعادة التلقائية`
  }
};

function pmMsg(key, ...args) {
  const v = (PMMSG[pmLang] || PMMSG.en)[key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}

// ======================
// LOG SINK
// main.js يضخّ sendLog هنا — كل رسالة تمر عبره فتُحفظ على القرص وتصل للواجهة
// ======================
let logSink = null;

function setLogSink(fn) {
  if (typeof fn === 'function') logSink = fn;
}

function emitLog(win, id, type, message) {
  if (logSink) { logSink(id, type, message); return; }
  win?.webContents.send('project-log', { id, type, message });
}

// ======================
// PORT CHECKER
// فحص بالاتصال الفعلي (connect) بدل محاولة الربط (listen):
// الربط على Windows يمكن أن ينجح زورًا بفضل SO_REUSEADDR حتى مع وجود خادم
// يستمع على 127.0.0.1 تحديدًا — الاتصال يفحص وجود مستمع حقيقي
// ======================
function canConnect(port, host) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host, timeout: 800 });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function isPortInUse(port) {
  return (await canConnect(port, '127.0.0.1')) || (await canConnect(port, '::1'));
}

async function findFreePort(startPort = 3000, exclude = []) {
  const banned = new Set(exclude);
  let port = startPort;
  while (banned.has(port) || await isPortInUse(port)) port++;
  return port;
}

// ======================
// DETECT PACKAGE MANAGER
// الأولوية: حقل packageManager في package.json ثم ملفات القفل
// ======================
function detectPackageManager(projectPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
    if (typeof pkg.packageManager === 'string') {
      const name = pkg.packageManager.split('@')[0];
      if (['npm', 'pnpm', 'yarn', 'bun'].includes(name)) return name;
    }
  } catch {}

  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'bun.lockb')) ||
      fs.existsSync(path.join(projectPath, 'bun.lock'))) return 'bun';
  return 'npm';
}

// ======================
// DETECT FRAMEWORK
// يحدد كيفية تمرير البورت: علم --port يعمل مع Vite/Next/Angular فقط
// ======================
function detectFramework(projectPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps.next) return 'next';
    if (deps['react-scripts']) return 'cra';
    if (deps['@angular/cli'] || deps['@angular/core']) return 'angular';
    if (deps.vite || deps.nuxt || deps['@nuxt/kit']) return 'vite';
    return 'generic';
  } catch {
    return 'generic';
  }
}

// ======================
// BUILD RUN ARGS
// npm/pnpm تحتاجان فاصل -- قبل المعاملات؛ yarn/bun يمررانها مباشرة
// CRA/generic يعتمدان على متغير البيئة PORT فقط
// ======================
function buildRunArgs(pm, script, framework, port) {
  const args = ['run', script];
  const supportsPortFlag = framework === 'vite' || framework === 'next' || framework === 'angular';

  if (supportsPortFlag) {
    if (pm === 'npm' || pm === 'pnpm') args.push('--');
    args.push('--port', String(port));
  }
  return args;
}

// ======================
// SET STATUS
// ======================
function setStatus(id, status, win) {
  processStatus[id] = status;
  win?.webContents.send('project-status', { id, status });
}

// ======================
// EXTRACT PORT
// ======================
function extractPort(text) {
  const patterns = [
    /Local:\s+https?:\/\/localhost:(\d+)/i,
    /localhost:(\d+)/i,
    /127\.0\.0\.1:(\d+)/i,
    /(?:port|on)\s+:?(\d{4,5})/i,
    /:(\d{4,5})\//,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function isPortScanNoise(text) {
  return /Port \d+ is in use, trying another one/i.test(text);
}

// ======================
// KILL PROCESS TREE (cross-platform)
// ======================
function killTree(proc, callback) {
  if (!proc) { callback?.(); return; }

  if (process.platform === 'win32') {
    exec(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true }, () => callback?.());
  } else {
    // detached جعل العملية قائدة مجموعة — الإشارة السالبة تقتل المجموعة كاملة
    try { process.kill(-proc.pid, 'SIGKILL'); }
    catch {
      try { proc.kill('SIGKILL'); } catch {}
    }
    callback?.();
  }
}

// ======================
// START PROJECT
// تحقق من node_modules أولاً
// ======================
function startProject(id, project, win) {
  if (processes[id]) {
    emitLog(win, id, 'warn', pmMsg('alreadyRunning', project.name || id));
    return;
  }

  // تشغيل يدوي جديد يصفّر محاولات الإعادة التلقائية السابقة
  restartPolicy.reset(id);

  setStatus(id, 'booting', win);

  const pm = detectPackageManager(project.path);
  const nodeModulesPath = path.join(project.path, 'node_modules');
  const needsInstall = !fs.existsSync(nodeModulesPath);

  if (needsInstall) {
    emitLog(win, id, 'system', pmMsg('installing', pm));

    const installer = spawn(pm, ['install'], {
      cwd: project.path,
      env: { ...process.env },
      windowsHide: true,
      detached: process.platform !== 'win32'
    });

    // نتعقب المثبّت أيضًا حتى يمكن إيقافه أو قتله عند خروج التطبيق
    processes[id] = installer;

    const pipeOutput = (data) => {
      data.toString().split('\n').forEach(line => {
        const t = line.trim();
        if (t) emitLog(win, id, 'log', t);
      });
    };

    installer.stdout.on('data', pipeOutput);
    installer.stderr.on('data', pipeOutput);

    installer.on('close', (code) => {
      delete processes[id];
      if (killedIds.delete(id)) return;

      if (code !== 0) {
        setStatus(id, 'stopped', win);
        emitLog(win, id, 'error', pmMsg('installFailed', pm, code));
        return;
      }
      emitLog(win, id, 'system', pmMsg('installDone', pm));
      launchDevServer(id, project, win);
    });

    installer.on('error', (err) => {
      delete processes[id];
      if (killedIds.delete(id)) return;
      setStatus(id, 'stopped', win);
      emitLog(win, id, 'error', pmMsg('installError', pm, err.message));
    });

    return; // ننتظر installer ينتهي
  }

  // node_modules موجود — شغّل مباشرة
  launchDevServer(id, project, win);
}

// ======================
// LAUNCH DEV SERVER
// ======================
function launchDevServer(id, project, win) {
  const script = project.script || 'dev';
  const pm = detectPackageManager(project.path);
  const framework = detectFramework(project.path);
  const args = buildRunArgs(pm, script, framework, project.port);

  // PORT يُمرَّر دائمًا — CRA والمشاريع العامة تعتمد عليه
  const env = {
    ...process.env,
    VITE_PORT: String(project.port),
    PORT: String(project.port)
  };

  emitLog(win, id, 'system', `⚙️ ${pm} ${args.join(' ')}  [${framework}]`);

  const proc = spawn(pm, args, {
    cwd: project.path,
    env,
    windowsHide: true,
    detached: process.platform !== 'win32'
  });

  processes[id] = proc;
  let isRunning = false;

  // سيرفرات هادئة لا تطبع بورتًا بصيغة معروفة:
  // بعد 10 ثوانٍ بلا كشف وبلا موت تُعتبر شغالة فعلًا
  const quietFallback = setTimeout(() => {
    if (!isRunning && processes[id] === proc && proc.exitCode === null) {
      isRunning = true;
      // الإقلاع الصامت الناجح يقطع سلسلة الانهيارات السابقة
      restartPolicy.reset(id);
      setStatus(id, 'running', win);
    }
  }, 10000);

  function handleOutput(text, isStderr) {
    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isPortScanNoise(trimmed)) return;

      let type = 'log';
      if (isStderr) {
        const isRealError = /\b(error|failed|cannot|unexpected)\b/i.test(trimmed)
          && !/Local:|Network:|VITE|ready|running|listening/i.test(trimmed);
        type = isRealError ? 'error' : 'log';
      }

      emitLog(win, id, type, trimmed);
    });

    if (!isRunning) {
      const port = extractPort(text);
      if (port) {
        isRunning = true;
        // وصل السيرفر لحالة التشغيل — صفّر محاولات الإعادة التلقائية
        restartPolicy.reset(id);
        setStatus(id, 'running', win);
        win?.webContents.send('project-port', { id, port });

        // autoOpen معطل - زر "فتح" فقط هو المسؤول عن فتح المتصفح
      }
    }
  }

  proc.stdout.on('data', (data) => handleOutput(data.toString(), false));
  proc.stderr.on('data', (data) => handleOutput(data.toString(), true));

  proc.on('close', (code) => {
    clearTimeout(quietFallback);
    delete processes[id];
    const intentional = killedIds.delete(id);
    setStatus(id, 'stopped', win);

    if (intentional) {
      restartPolicy.reset(id);
      emitLog(win, id, 'log', pmMsg('stoppedByUser', project.name));
      return;
    }

    emitLog(win, id, 'log', pmMsg('stoppedUnexpectedly', code));

    // إعادة التشغيل التلقائي عند الانهيار (لا يشمل التوقف اليدوي)
    if (project.autoRestart && code !== 0) {
      const restart = restartPolicy.next(id);
      if (!restart) {
        emitLog(win, id, 'error', pmMsg('autoRestartGaveUp', project.name));
        return;
      }
      emitLog(win, id, 'system', pmMsg('autoRestarting', project.name));
      setTimeout(() => launchDevServer(id, project, win), restart.delayMs);
    }
  });

  proc.on('error', (err) => {
    clearTimeout(quietFallback);
    delete processes[id];
    killedIds.delete(id);
    setStatus(id, 'stopped', win);
    emitLog(win, id, 'error', pmMsg('launchError', err.message));
  });
}

// ======================
// STOP PROJECT
// onStopped يُستدعى بعد موت العملية فعليًا (حدث close) أو بعد 3 ثوانٍ كحد أقصى
// ======================
function stopProject(id, project, win, onStopped) {
  const proc = processes[id];

  if (!proc) {
    emitLog(win, id, 'warn', pmMsg('notRunning', project.name));
    setStatus(id, 'stopped', win);
    restartPolicy.reset(id);
    onStopped?.();
    return;
  }

  setStatus(id, 'stopped', win);
  killedIds.add(id);
  restartPolicy.reset(id);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onStopped?.();
  };

  proc.once('close', finish);
  killTree(proc);
  setTimeout(finish, 3000);
}

// ======================
// RESTART PROJECT
// ======================
function restartProject(id, project, win) {
  emitLog(win, id, 'log', pmMsg('restarting', project.name));

  stopProject(id, project, win, () => {
    // مهلة قصيرة لضمان تحرر البورت من نظام التشغيل بعد موت العملية
    setTimeout(() => launchDevServer(id, project, win), 300);
  });
}

// ======================
// STOP ALL (عند إغلاق التطبيق)
// ======================
function hasRunningProcesses() {
  return Object.keys(processes).length > 0;
}

function stopAllProjects() {
  const running = Object.values(processes);
  for (const id of Object.keys(processes)) killedIds.add(id);
  processes = {};

  return Promise.all(running.map(proc => new Promise(resolve => {
    killTree(proc, resolve);
    setTimeout(resolve, 3000);
  })));
}

function getStatus(id) {
  return processStatus[id] || 'stopped';
}

// ======================
// WRITE TO STDIN
// إرسال سطر إدخال تفاعلي للعملية — مشاريع فيها أسئلة أثناء التشغيل
// ======================
function writeStdin(id, line) {
  const proc = processes[id];
  if (!proc || !proc.stdin || !proc.stdin.writable) return false;
  try {
    proc.stdin.write(line + '\n');
    return true;
  } catch {
    return false;
  }
}

// معرفات العمليات الشغالة — لمراقبة الموارد من main
function getRunningPids() {
  const out = {};
  for (const [id, proc] of Object.entries(processes)) {
    if (proc && proc.pid) out[id] = proc.pid;
  }
  return out;
}

module.exports = {
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
};
