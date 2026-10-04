const { exec, spawn: nativeSpawn } = require('child_process');
const spawn = require('cross-spawn');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { createRestartPolicy } = require('./restartPolicy');
const { formatProcessMessage } = require('./messages');

function buildRunArgs(pm, script, framework, port) {
  const args = ['run', script];
  const supportsPortFlag = framework === 'vite' || framework === 'next' || framework === 'angular';

  if (supportsPortFlag) {
    if (pm === 'npm' || pm === 'pnpm') args.push('--');
    args.push('--port', String(port));
  }
  return args;
}

function buildLaunchSpec(project, { packageManager, framework, baseEnv }) {
  if (project.customCommand) {
    return {
      command: project.customCommand,
      args: [],
      env: {
        ...baseEnv,
        PYTHONUNBUFFERED: '1',
        ...(Number.isInteger(project.port) && project.port >= 1 && project.port <= 65535
          ? { PORT: String(project.port) }
          : {})
      },
      shell: true
    };
  }

  return {
    command: packageManager,
    args: buildRunArgs(packageManager, project.script || 'dev', framework, project.port),
    env: { ...baseEnv, VITE_PORT: String(project.port), PORT: String(project.port) },
    shell: false
  };
}

function createProcessManager({
  spawnProcess = (command, args, options) =>
    options.shell ? nativeSpawn(command, args, options) : spawn(command, args, options),
  checkPort = null,
  killProcessTree = null,
  scheduleTimeout = setTimeout,
  clearScheduledTimeout = clearTimeout
} = {}) {
  const records = new Map();
  function recordFor(id) {
    if (!records.has(id)) {
      records.set(id, {
        process: null,
        kind: null,
        phase: 'stopped',
        status: 'stopped',
        restartTimer: null,
        generation: 0
      });
    }
    return records.get(id);
  }

  // Track process identity so an old close event cannot affect a newer process.
  const killedProcesses = new Set();

  // Per-project automatic restart policy.
  const restartPolicy = createRestartPolicy();
  const stdinObserved = new WeakSet();
  const stdinFailed = new WeakSet();

  function advanceEpoch(id) {
    return ++recordFor(id).generation;
  }

  function cancelPendingRestart(id) {
    const record = recordFor(id);
    const timer = record.restartTimer;
    if (timer) clearScheduledTimeout(timer);
    record.restartTimer = null;
  }

  // ======================
  // Process-manager messages follow the UI language (English by default).
  // ======================
  let pmLang = 'en';

  function setUiLanguage(lang) {
    if (lang === 'ar' || lang === 'en') pmLang = lang;
  }

  function pmMsg(key, ...args) {
    return formatProcessMessage(pmLang, key, ...args);
  }

  // ======================
  // LOG SINK
  // main.js injects sendLog so every message reaches both disk and the UI.
  // ======================
  let logSink = null;
  let portSink = null;
  let statusSink = null;

  function setLogSink(fn) {
    if (typeof fn === 'function') logSink = fn;
  }

  function setPortSink(fn) {
    portSink = typeof fn === 'function' ? fn : null;
  }

  function setStatusSink(fn) {
    statusSink = typeof fn === 'function' ? fn : null;
  }

  function emitLog(win, id, type, message) {
    if (logSink) {
      logSink(id, type, message);
      return;
    }
    win?.webContents.send('project-log', { id, type, message });
  }

  // ======================
  // PORT CHECKER
  // Probe by connecting rather than binding: on Windows, SO_REUSEADDR can make
  // listen succeed even when a server already owns 127.0.0.1.
  // ======================
  function canConnect(port, host) {
    return new Promise((resolve) => {
      const sock = net.connect({ port, host, timeout: 800 });
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', () => resolve(false));
      sock.once('timeout', () => {
        sock.destroy();
        resolve(false);
      });
    });
  }

  async function isPortInUse(port) {
    return (await canConnect(port, '127.0.0.1')) || (await canConnect(port, '::1'));
  }

  async function findFreePort(startPort = 3000, exclude = []) {
    const banned = new Set(exclude);
    let port = startPort;
    while (banned.has(port) || (await (checkPort || isPortInUse)(port))) port++;
    return port;
  }

  // ======================
  // DETECT PACKAGE MANAGER
  // Prefer package.json's packageManager field, then lockfiles.
  // ======================
  function detectPackageManager(projectPath) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
      if (typeof pkg.packageManager === 'string') {
        const name = pkg.packageManager.split('@')[0];
        if (['npm', 'pnpm', 'yarn', 'bun'].includes(name)) return name;
      }
    } catch {
      // A missing or malformed package.json falls back to lockfile detection.
    }

    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(projectPath, 'bun.lockb')) || fs.existsSync(path.join(projectPath, 'bun.lock')))
      return 'bun';
    return 'npm';
  }

  // ======================
  // DETECT FRAMEWORK
  // Only Vite, Next, and Angular accept the --port argument here.
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
  // npm and pnpm need -- before script arguments; yarn and bun do not.
  // CRA and generic projects use the PORT environment variable only.
  // ======================
  // ======================
  // SET STATUS
  // ======================
  function setStatus(id, status, win) {
    const record = recordFor(id);
    record.phase = status;
    const displayed = status === 'stopping' ? 'stopped' : status === 'backoff' ? 'booting' : status;
    record.status = displayed;
    statusSink?.(id, displayed);
    win?.webContents.send('project-status', { id, status: displayed });
  }

  // ======================
  // EXTRACT PORT
  // ======================
  function extractPort(text) {
    for (const rawLine of text.split(/\r?\n/)) {
      // ANSI escape codes are control characters intentionally removed from process output.
      // eslint-disable-next-line no-control-regex
      const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '');
      if (/\b(?:redis|postgres(?:ql)?|mysql|mongo(?:db)?|database)\b/i.test(line)) continue;

      const local = line.match(/\bLocal:\s+https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{1,5})\b/i);
      if (local && Number(local[1]) >= 1 && Number(local[1]) <= 65535) return Number(local[1]);

      if (!/\b(?:listening|ready|running)\b/i.test(line)) continue;
      const host = line.match(/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{1,5})\b/i);
      const port = line.match(/\bport\s*[:=]?\s*(\d{1,5})\b/i);
      const value = Number((host || port)?.[1]);
      if (value >= 1 && value <= 65535) return value;
    }
    return null;
  }

  function isPortScanNoise(text) {
    return /Port \d+ is in use, trying another one/i.test(text);
  }

  function createLineConsumer(onLine) {
    let pending = '';
    return {
      write(chunk) {
        pending += chunk.toString();
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          onLine(pending.slice(0, newline).replace(/\r$/, ''));
          pending = pending.slice(newline + 1);
        }
      },
      flush() {
        if (pending) onLine(pending.replace(/\r$/, ''));
        pending = '';
      }
    };
  }

  // ======================
  // KILL PROCESS TREE (Windows)
  // ======================
  function killTree(proc, callback) {
    if (!proc) {
      callback?.();
      return;
    }

    exec(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true }, () => {
      if (proc.exitCode === null) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // The process may already have exited after taskkill.
        }
      }
      callback?.();
    });
  }

  // ======================
  // START PROJECT
  // Check node_modules before starting the project.
  // ======================
  function startProject(id, project, win) {
    advanceEpoch(id);
    cancelPendingRestart(id);
    if (recordFor(id).process) {
      emitLog(win, id, 'warn', pmMsg('alreadyRunning', project.name || id));
      return;
    }

    // A fresh manual start resets prior automatic restart attempts.
    restartPolicy.reset(id);

    setStatus(id, 'booting', win);

    if (project.customCommand) {
      launchDevServer(id, project, win);
      return;
    }

    const pm = detectPackageManager(project.path);
    const nodeModulesPath = path.join(project.path, 'node_modules');
    const needsInstall = !fs.existsSync(nodeModulesPath);

    if (needsInstall) {
      emitLog(win, id, 'system', pmMsg('installing', pm));

      const installer = spawnProcess(pm, ['install'], {
        cwd: project.path,
        env: { ...process.env },
        windowsHide: true,
        detached: false
      });

      // Track the installer too so Stop and app shutdown can terminate it.
      recordFor(id).process = installer;
      recordFor(id).kind = 'installer';

      const stdoutLines = createLineConsumer((line) => {
        if (line.trim()) emitLog(win, id, 'log', line.trim());
      });
      const stderrLines = createLineConsumer((line) => {
        if (line.trim()) emitLog(win, id, 'log', line.trim());
      });

      installer.stdout.on('data', (data) => stdoutLines.write(data));
      installer.stderr.on('data', (data) => stderrLines.write(data));

      installer.on('close', (code) => {
        stdoutLines.flush();
        stderrLines.flush();
        const current = recordFor(id).process === installer;
        if (current) {
          recordFor(id).process = null;
          recordFor(id).kind = null;
        }
        const intentional = killedProcesses.delete(installer);
        if (!current || intentional) return;

        if (code !== 0) {
          setStatus(id, 'stopped', win);
          emitLog(win, id, 'error', pmMsg('installFailed', pm, code));
          return;
        }
        emitLog(win, id, 'system', pmMsg('installDone', pm));
        launchDevServer(id, project, win);
      });

      installer.on('error', (err) => {
        const current = recordFor(id).process === installer;
        if (current) {
          recordFor(id).process = null;
          recordFor(id).kind = null;
        }
        const intentional = killedProcesses.delete(installer);
        if (!current || intentional) return;
        setStatus(id, 'stopped', win);
        emitLog(win, id, 'error', pmMsg('installError', pm, err.message));
      });

      return; // Wait for the installer to finish.
    }

    // Dependencies are present; launch the script directly.
    launchDevServer(id, project, win);
  }

  // ======================
  // LAUNCH DEV SERVER
  // ======================
  function launchDevServer(id, project, win) {
    if (recordFor(id).process || recordFor(id).restartTimer) {
      emitLog(win, id, 'warn', pmMsg('alreadyRunning', project.name || id));
      return;
    }
    setStatus(id, 'booting', win);
    const custom = !!project.customCommand;
    const packageManager = custom ? null : detectPackageManager(project.path);
    const framework = custom ? null : detectFramework(project.path);
    const spec = buildLaunchSpec(project, { packageManager, framework, baseEnv: process.env });

    emitLog(
      win,
      id,
      'system',
      custom ? `⚙️ ${spec.command}  [custom]` : `⚙️ ${spec.command} ${spec.args.join(' ')}  [${framework}]`
    );

    const proc = spawnProcess(spec.command, spec.args, {
      cwd: project.path,
      env: spec.env,
      shell: spec.shell,
      windowsHide: true,
      detached: false
    });

    recordFor(id).process = proc;
    recordFor(id).kind = 'server';
    let isRunning = false;
    let detectedPort = null;
    let probing = false;

    // Log text does not prove readiness; a successful port connection does.
    const readinessProbe =
      project.port == null
        ? null
        : setInterval(async () => {
            if (isRunning || recordFor(id).process !== proc || proc.exitCode !== null || killedProcesses.has(proc)) {
              clearInterval(readinessProbe);
              return;
            }
            const port = detectedPort || project.port;
            if (!Number.isInteger(port) || port < 1 || port > 65535 || probing) return;
            probing = true;
            try {
              if (
                (await (checkPort || isPortInUse)(port)) &&
                recordFor(id).process === proc &&
                proc.exitCode === null &&
                !killedProcesses.has(proc) &&
                !isRunning
              ) {
                isRunning = true;
                restartPolicy.reset(id);
                setStatus(id, 'running', win);
                portSink?.(id, port);
                win?.webContents.send('project-port', { id, port });
                clearInterval(readinessProbe);
              }
            } finally {
              probing = false;
            }
          }, 400);

    if (custom && project.port == null) {
      proc.on('spawn', () => {
        if (recordFor(id).process !== proc || proc.exitCode !== null || killedProcesses.has(proc) || isRunning) return;
        isRunning = true;
        restartPolicy.reset(id);
        setStatus(id, 'running', win);
      });
    }

    function handleOutput(line, isStderr) {
      const trimmed = line.trim();
      if (!trimmed || isPortScanNoise(trimmed)) return;

      let type = 'log';
      if (isStderr) {
        const isRealError =
          /\b(error|failed|cannot|unexpected)\b/i.test(trimmed) &&
          !/Local:|Network:|VITE|ready|running|listening/i.test(trimmed);
        type = isRealError ? 'error' : 'log';
      }

      emitLog(win, id, type, trimmed);
      if (!isRunning) detectedPort = extractPort(trimmed) || detectedPort;
    }

    const stdoutLines = createLineConsumer((line) => handleOutput(line, false));
    const stderrLines = createLineConsumer((line) => handleOutput(line, true));
    proc.stdout.on('data', (data) => stdoutLines.write(data));
    proc.stderr.on('data', (data) => stderrLines.write(data));

    proc.on('close', (code) => {
      stdoutLines.flush();
      stderrLines.flush();
      clearInterval(readinessProbe);
      const current = recordFor(id).process === proc;
      if (current) {
        recordFor(id).process = null;
        recordFor(id).kind = null;
      }
      const intentional = killedProcesses.delete(proc);
      if (!current) return;
      setStatus(id, 'stopped', win);

      if (intentional) {
        restartPolicy.reset(id);
        emitLog(win, id, 'log', pmMsg('stoppedByUser', project.name));
        return;
      }

      emitLog(win, id, 'log', pmMsg('stoppedUnexpectedly', code));

      // Auto-restart after a crash, never after an explicit stop.
      if (project.autoRestart && code !== 0) {
        const restart = restartPolicy.next(id);
        if (!restart) {
          emitLog(win, id, 'error', pmMsg('autoRestartGaveUp', project.name));
          return;
        }
        emitLog(win, id, 'system', pmMsg('autoRestarting', project.name));
        setStatus(id, 'backoff', win);
        const expectedEpoch = recordFor(id).generation;
        const timer = scheduleTimeout(() => {
          const record = recordFor(id);
          if (record.restartTimer !== timer || record.generation !== expectedEpoch) return;
          record.restartTimer = null;
          launchDevServer(id, project, win);
        }, restart.delayMs);
        recordFor(id).restartTimer = timer;
      }
    });

    proc.on('error', (err) => {
      clearInterval(readinessProbe);
      const current = recordFor(id).process === proc;
      if (current) {
        recordFor(id).process = null;
        recordFor(id).kind = null;
      }
      killedProcesses.delete(proc);
      if (!current) return;
      setStatus(id, 'stopped', win);
      emitLog(win, id, 'error', pmMsg('launchError', err.message));
    });
  }

  // ======================
  // STOP PROJECT
  // Call onStopped only after close; a timeout does not prove process exit.
  // ======================
  function stopProject(id, project, win, onStopped) {
    advanceEpoch(id);
    cancelPendingRestart(id);
    const proc = recordFor(id).process;

    if (!proc) {
      emitLog(win, id, 'warn', pmMsg('notRunning', project.name));
      setStatus(id, 'stopped', win);
      restartPolicy.reset(id);
      onStopped?.();
      return;
    }

    setStatus(id, 'stopping', win);
    killedProcesses.add(proc);
    restartPolicy.reset(id);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onStopped?.();
    };

    proc.once('close', finish);
    (killProcessTree || killTree)(proc);
  }

  function forgetProject(id, project, win) {
    const clearState = () => {
      const record = recordFor(id);
      record.phase = 'stopped';
      record.status = 'stopped';
      restartPolicy.reset(id);
    };
    if (recordFor(id).process) {
      stopProject(id, project, win, clearState);
    } else {
      advanceEpoch(id);
      cancelPendingRestart(id);
      clearState();
    }
  }

  // ======================
  // RESTART PROJECT
  // ======================
  function restartProject(id, project, win) {
    emitLog(win, id, 'log', pmMsg('restarting', project.name));

    const expectedEpoch = recordFor(id).generation + 1;
    stopProject(id, project, win, () => {
      if (recordFor(id).generation !== expectedEpoch) return;
      // Allow the OS a brief interval to release the port after process exit.
      setStatus(id, 'booting', win);
      const timer = scheduleTimeout(() => {
        const record = recordFor(id);
        if (record.restartTimer !== timer || record.generation !== expectedEpoch) return;
        record.restartTimer = null;
        launchDevServer(id, project, win);
      }, 300);
      recordFor(id).restartTimer = timer;
    });
  }

  // ======================
  // Stop every child during app shutdown.
  // ======================
  function hasRunningProcesses() {
    return [...records.values()].some((record) => !!record.process || !!record.restartTimer);
  }

  function stopAllProjects() {
    for (const [id, record] of records) {
      if (!record.process && !record.restartTimer) continue;
      advanceEpoch(id);
      cancelPendingRestart(id);
      setStatus(id, 'stopped');
    }
    const running = [];
    for (const record of records.values()) {
      const proc = record.process;
      if (!proc) continue;
      running.push(proc);
      killedProcesses.add(proc);
      record.process = null;
      record.kind = null;
    }

    return Promise.all(
      running.map(
        (proc) =>
          new Promise((resolve) => {
            (killProcessTree || killTree)(proc, resolve);
            scheduleTimeout(resolve, 3000);
          })
      )
    );
  }

  function getStatus(id) {
    return records.get(id)?.status || 'stopped';
  }

  function getPhase(id) {
    return records.get(id)?.phase || 'stopped';
  }

  // ======================
  // WRITE TO STDIN
  // Forward interactive input to projects that prompt while running.
  // ======================
  function writeStdin(id, line) {
    const proc = recordFor(id).process;
    if (!proc || !proc.stdin || !proc.stdin.writable || stdinFailed.has(proc.stdin)) return false;
    if (!stdinObserved.has(proc.stdin)) {
      stdinObserved.add(proc.stdin);
      proc.stdin.on('error', (err) => {
        stdinFailed.add(proc.stdin);
        emitLog(null, id, 'error', pmMsg('stdinError', err.message));
      });
    }
    try {
      proc.stdin.write(line + '\n');
      return true;
    } catch (err) {
      stdinFailed.add(proc.stdin);
      emitLog(null, id, 'error', pmMsg('stdinError', err.message));
      return false;
    }
  }

  // Expose running PIDs for resource monitoring in main.js.
  function getRunningPids() {
    const out = {};
    for (const [id, record] of records) {
      const proc = record.process;
      if (proc && proc.pid) out[id] = proc.pid;
    }
    return out;
  }

  return {
    startProject,
    launchDevServer,
    stopProject,
    forgetProject,
    restartProject,
    stopAllProjects,
    hasRunningProcesses,
    getStatus,
    getPhase,
    getRunningPids,
    findFreePort,
    isPortInUse,
    detectPackageManager,
    detectFramework,
    buildRunArgs,
    killTree,
    extractPort,
    setUiLanguage,
    writeStdin,
    setLogSink,
    setPortSink,
    setStatusSink,
    cancelPendingRestart
  };
}

module.exports = { createProcessManager, buildLaunchSpec };
