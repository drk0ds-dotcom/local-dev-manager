const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawn, execFile } = require('node:child_process');

const { createProcessManager } = require('../processManager');

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  return child;
}

function waitForStatus(manager, id, expected, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      if (manager.getStatus(id) === expected) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        reject(new Error(`Expected ${expected}, got ${manager.getStatus(id)}`));
      }
    }, 20);
  });
}

test('a portless custom child starts without npm and is running only while alive', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-worker-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const launched = [];
  const manager = createProcessManager({
    spawnProcess: (command, args, options) => {
      const child = fakeChild();
      launched.push({ command, args, options, child });
      return child;
    },
    killProcessTree: (_child, done) => done?.()
  });
  t.after(() => manager.stopAllProjects());
  const project = { id: 'worker', name: 'Worker', path: directory, port: null, customCommand: 'python worker.py' };

  manager.startProject('worker', project);
  assert.equal(launched.length, 1);
  assert.equal(launched[0].command, 'python worker.py');
  assert.deepEqual(launched[0].args, []);
  assert.equal(launched[0].options.cwd, directory);
  assert.equal(launched[0].options.shell, true);
  assert.equal(manager.getStatus('worker'), 'booting');
  launched[0].child.emit('spawn');
  assert.equal(manager.getStatus('worker'), 'running');

  launched[0].child.exitCode = 0;
  launched[0].child.emit('close', 0);
  assert.equal(manager.getStatus('worker'), 'stopped');
});

test('a custom project with a port waits for socket readiness', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-server-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let listening = false;
  const child = fakeChild();
  const manager = createProcessManager({
    spawnProcess: () => child,
    checkPort: async () => listening,
    killProcessTree: (_child, done) => done?.()
  });
  t.after(() => manager.stopAllProjects());
  const project = { id: 'server', name: 'Server', path: directory, port: 5000, customCommand: 'go run .' };

  manager.startProject('server', project);
  child.emit('spawn');
  assert.equal(manager.getStatus('server'), 'booting');
  listening = true;
  await waitForStatus(manager, 'server', 'running');
  child.exitCode = 0;
  child.emit('close', 0);
  assert.equal(manager.getStatus('server'), 'stopped');
});

test('a custom server that announces a different listening port uses the reachable port', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-moved-port-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const checked = [];
  const child = fakeChild();
  const manager = createProcessManager({
    spawnProcess: () => child,
    checkPort: async (port) => {
      checked.push(port);
      return port === 4902;
    },
    killProcessTree: (_child, done) => done?.()
  });
  t.after(() => manager.stopAllProjects());

  manager.startProject('server', {
    id: 'server',
    name: 'Server',
    path: directory,
    port: 4901,
    customCommand: 'node server.js'
  });
  child.stdout.emit('data', Buffer.from('Server started on 4902\n'));
  await waitForStatus(manager, 'server', 'running');
  assert.ok(checked.includes(4902));
  child.exitCode = 0;
  child.emit('close', 0);
});

test('an unresponsive configured port stays booting and reports why', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-unready-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  const logs = [];
  let clock = 0;
  const manager = createProcessManager({
    spawnProcess: () => child,
    checkPort: async () => false,
    now: () => clock,
    killProcessTree: (_child, done) => done?.()
  });
  manager.setLogSink((_id, type, message) => logs.push({ type, message }));
  t.after(() => manager.stopAllProjects());

  manager.startProject('server', {
    id: 'server',
    name: 'Server',
    path: directory,
    port: 4901,
    customCommand: 'node server.js'
  });
  clock = 10001;
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(manager.getStatus('server'), 'booting');
  assert.ok(logs.some(({ type, message }) => type === 'warn' && /4901/.test(message)));
  child.exitCode = 0;
  child.emit('close', 0);
});

test('waiting-port badge follows the current port and clears only after TCP responds', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-waiting-port-badge-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  const statuses = [];
  let ready = false;
  const win = {
    webContents: {
      send: (channel, data) => {
        if (channel === 'project-status') statuses.push(data);
      }
    }
  };
  const manager = createProcessManager({
    spawnProcess: () => child,
    checkPort: async (port) => ready && port === 4902,
    killProcessTree: (_child, done) => done?.()
  });
  t.after(() => manager.stopAllProjects());
  const project = { id: 'server', name: 'Server', path: directory, port: 4901, customCommand: 'node server.js' };

  manager.startProject('server', project, win);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(manager.getStatus('server'), 'booting');
  assert.equal(statuses.at(-1).badgeText.en, 'Waiting for port 4901');

  child.stdout.emit('data', Buffer.from('Server started on 4902\n'));
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(statuses.at(-1).badgeText.ar, 'بانتظار المنفذ 4902');

  ready = true;
  await waitForStatus(manager, 'server', 'running');
  assert.equal(statuses.at(-1).status, 'running');
  assert.equal(statuses.at(-1).badgeText, undefined);
  child.exitCode = 0;
  child.emit('close', 0);
});

test('Stop cancels a portless custom crash restart even after a quick exit', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-crash-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const children = [];
  const timers = [];
  const manager = createProcessManager({
    spawnProcess: () => {
      const child = fakeChild();
      children.push(child);
      return child;
    },
    scheduleTimeout: (callback) => {
      const timer = { callback, canceled: false };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: (timer) => {
      timer.canceled = true;
    },
    killProcessTree: (_child, done) => done?.()
  });
  const project = {
    id: 'crash',
    name: 'Crash',
    path: directory,
    port: null,
    customCommand: 'python crash.py',
    autoRestart: true
  };

  manager.startProject('crash', project);
  children[0].emit('spawn');
  children[0].exitCode = 1;
  children[0].emit('close', 1);
  assert.equal(manager.getStatus('crash'), 'booting');
  assert.equal(timers.length, 1);
  manager.stopProject('crash', project);
  assert.equal(timers[0].canceled, true);
  timers[0].callback();
  assert.equal(children.length, 1);
  assert.equal(manager.getStatus('crash'), 'stopped');
});

test('a portless custom launch error leaves the project stopped', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-error-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  const manager = createProcessManager({ spawnProcess: () => child });
  const project = { id: 'missing', name: 'Missing', path: directory, port: null, customCommand: 'missing-tool' };

  manager.startProject('missing', project);
  child.emit('error', new Error('not found'));
  child.emit('spawn');
  assert.equal(manager.getStatus('missing'), 'stopped');
});

test('a portless custom restart waits for close before launching one replacement', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-custom-restart-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const children = [];
  const timers = [];
  const manager = createProcessManager({
    spawnProcess: () => {
      const child = fakeChild();
      children.push(child);
      return child;
    },
    killProcessTree: () => {},
    scheduleTimeout: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    }
  });
  const project = { id: 'worker', name: 'Worker', path: directory, port: null, customCommand: 'python worker.py' };

  manager.startProject('worker', project);
  children[0].emit('spawn');
  manager.restartProject('worker', project);
  assert.equal(children.length, 1);
  children[0].exitCode = 0;
  children[0].emit('close', 0);
  assert.equal(timers.filter((timer) => timer.delay === 300).length, 1);
  timers.find((timer) => timer.delay === 300).callback();
  assert.equal(children.length, 2);
  children[1].emit('spawn');
  assert.equal(manager.getStatus('worker'), 'running');
  children[1].exitCode = 0;
  children[1].emit('close', 0);
  assert.equal(manager.getStatus('worker'), 'stopped');
});

test('two process managers keep the same project id in separate states', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-factory-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  function fakeProcess() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.exitCode = null;
    return child;
  }
  const options = {
    spawnProcess: fakeProcess,
    killProcessTree: (child, done) => {
      child.emit('close', 0);
      done();
    }
  };
  const first = createProcessManager(options);
  const second = createProcessManager(options);
  const project = { id: 'shared', name: 'shared', path: directory, port: 3000, script: 'dev' };

  first.startProject('shared', project);
  assert.equal(first.getStatus('shared'), 'booting');
  assert.equal(second.getStatus('shared'), 'stopped');
  assert.deepEqual(second.getRunningPids(), {});
  await first.stopAllProjects();
  assert.equal(second.getStatus('shared'), 'stopped');
});

test('Stopping remains visible until the child closes; crash backoff stays booting', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-phases-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'node_modules'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  const children = [];
  t.after(() => {
    for (const child of children) child.emit('error', new Error('test cleanup'));
  });
  const canceled = [];
  const manager = createProcessManager({
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      children.push(child);
      return child;
    },
    checkPort: async () => false,
    killProcessTree: () => {},
    scheduleTimeout: (callback, delay) => ({ callback, delay }),
    clearScheduledTimeout: (timer) => canceled.push(timer)
  });
  const project = { id: 'shared', name: 'shared', path: directory, port: 3000, script: 'dev', autoRestart: true };

  manager.startProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'booting');
  manager.stopProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'stopping');
  assert.equal(manager.getStatus('shared'), 'stopping');
  children[0].emit('close', 0);
  assert.equal(manager.getPhase('shared'), 'stopped');
  assert.equal(manager.getStatus('shared'), 'stopped');

  manager.startProject('shared', project);
  children[1].emit('close', 1);
  assert.equal(manager.getPhase('shared'), 'backoff');
  assert.equal(manager.getStatus('shared'), 'booting');
  manager.stopProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'stopped');
  assert.equal(canceled.filter((timer) => timer.delay !== 3000).length, 1);
});

test('failed tree kill falls back to SIGKILL, times out visibly, and Stop can retry', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-stop-failure-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  child.pid = 43210;
  let signals = 0;
  child.kill = (signal) => {
    assert.equal(signal, 'SIGKILL');
    signals++;
    return true;
  };
  const timers = [];
  let killAttempts = 0;
  const logs = [];
  const manager = createProcessManager({
    spawnProcess: () => child,
    killProcessTree: (_proc, done) => {
      killAttempts++;
      done(new Error('taskkill exited 1'));
    },
    scheduleTimeout: (callback, delay) => {
      const timer = { callback, delay, canceled: false };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: (timer) => {
      timer.canceled = true;
    }
  });
  manager.setLogSink((id, type, message) => logs.push({ id, type, message }));
  const project = {
    id: 'worker',
    name: 'Worker',
    path: directory,
    port: null,
    customCommand: 'node worker.js',
    autoRestart: true
  };
  manager.startProject('worker', project);
  child.emit('spawn');

  manager.stopProject('worker', project);
  assert.equal(killAttempts, 1);
  assert.equal(signals, 1);
  assert.equal(manager.getStatus('worker'), 'stopping');
  const timeout = timers.find((timer) => timer.delay >= 1000);
  assert.ok(timeout);
  timeout.callback();
  assert.equal(manager.getStatus('worker'), 'stop-failed');
  assert.ok(logs.some(({ type, message }) => type === 'error' && message.includes('43210')));

  manager.stopProject('worker', project);
  assert.equal(killAttempts, 2);
  assert.equal(signals, 2);
  assert.equal(manager.getStatus('worker'), 'stopping');
  child.exitCode = 1;
  child.emit('close', 1);
  assert.equal(manager.getStatus('worker'), 'stopped');
  assert.equal(logs.filter(({ message }) => /auto-restart/i.test(message)).length, 0);
});

test('Quit is bounded and reports a child that did not exit', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-quit-failure-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  child.pid = 43211;
  child.kill = () => true;
  const timers = [];
  const logs = [];
  const manager = createProcessManager({
    spawnProcess: () => child,
    killProcessTree: (_proc, done) => done(new Error('taskkill exited 1')),
    scheduleTimeout: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: () => {}
  });
  manager.setLogSink((id, type, message) => logs.push({ id, type, message }));
  manager.startProject('worker', {
    id: 'worker',
    name: 'Worker',
    path: directory,
    port: null,
    customCommand: 'node worker.js'
  });

  const shutdown = manager.stopAllProjects();
  assert.equal(manager.getStatus('worker'), 'stopping');
  timers.find((timer) => timer.delay >= 1000).callback();
  const result = await shutdown;
  assert.equal(manager.getStatus('worker'), 'stop-failed');
  assert.equal(manager.hasRunningProcesses(), true);
  assert.deepEqual(result, [43211]);
  assert.ok(logs.some(({ id, type, message }) => id === '__system__' && type === 'error' && message.includes('43211')));
});

test('Quit during an in-flight Stop still resolves and reports a live child', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-quit-while-stopping-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  child.pid = 43212;
  const timers = [];
  const logs = [];
  const manager = createProcessManager({
    spawnProcess: () => child,
    killProcessTree: () => {},
    scheduleTimeout: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: () => {}
  });
  manager.setLogSink((id, type, message) => logs.push({ id, type, message }));
  const project = { id: 'worker', name: 'Worker', path: directory, port: null, customCommand: 'node worker.js' };
  manager.startProject('worker', project);
  manager.stopProject('worker', project);
  const shutdown = manager.stopAllProjects();
  for (const timer of timers.filter((item) => item.delay === 3000)) timer.callback();
  assert.equal(manager.getStatus('worker'), 'stop-failed');
  assert.ok(logs.some(({ id }) => id === '__system__'));
  assert.deepEqual(await shutdown, [43212]);
});

test('a synchronous kill failure still leaves Stop bounded and reports its PID', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-kill-throws-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const child = fakeChild();
  child.pid = 43213;
  child.kill = () => false;
  const timers = [];
  const manager = createProcessManager({
    spawnProcess: () => child,
    killProcessTree: () => {
      throw new Error('failed to launch taskkill');
    },
    scheduleTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return { callback, delay };
    }
  });
  const project = { id: 'worker', name: 'Worker', path: directory, port: null, customCommand: 'node worker.js' };
  manager.startProject('worker', project);
  assert.doesNotThrow(() => manager.stopProject('worker', project));
  timers.find((timer) => timer.delay === 3000).callback();
  assert.equal(manager.getStatus('worker'), 'stop-failed');
});

test('Windows falls back to SIGKILL after a failing kill script', { skip: process.platform !== 'win32' }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-real-stop-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let child;
  let fallbackSignals = 0;
  const manager = createProcessManager({
    spawnProcess: () => {
      child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true });
      const nativeKill = child.kill.bind(child);
      child.kill = (signal) => {
        if (signal === 'SIGKILL') fallbackSignals++;
        return nativeKill(signal);
      };
      return child;
    },
    killProcessTree: (_proc, done) => execFile(process.execPath, ['-e', 'process.exit(7)'], { windowsHide: true }, done)
  });
  t.after(() => {
    if (child?.exitCode === null) child.kill('SIGKILL');
  });
  const project = { id: 'worker', name: 'Worker', path: directory, port: null, customCommand: 'node worker.js' };
  manager.startProject('worker', project);
  await waitForStatus(manager, 'worker', 'running');
  manager.stopProject('worker', project);
  assert.equal(manager.getStatus('worker'), 'stopping');
  await waitForStatus(manager, 'worker', 'stopped', 5000);
  assert.equal(fallbackSignals, 1);
});

test('manual Start during backoff creates one child and invalidates the old timer', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-backoff-start-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'node_modules'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  const children = [];
  const timers = [];
  const manager = createProcessManager({
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      children.push(child);
      return child;
    },
    checkPort: async () => false,
    killProcessTree: () => {},
    scheduleTimeout: (callback) => {
      const timer = { callback };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: (timer) => {
      timer.canceled = true;
    }
  });
  t.after(() => {
    for (const child of children) child.emit('error', new Error('test cleanup'));
  });
  const project = { id: 'one', name: 'one', path: directory, port: 3000, autoRestart: true };

  manager.startProject('one', project);
  children[0].emit('close', 1);
  assert.equal(manager.getPhase('one'), 'backoff');
  manager.startProject('one', project);
  assert.equal(children.length, 2);
  assert.equal(timers[0].canceled, true);
  children[1].emit('close', 1);
  assert.equal(manager.getPhase('one'), 'backoff');
  assert.equal(timers.length, 2);
  timers[0].callback();
  assert.equal(children.length, 2);
  manager.stopProject('one', project);
  assert.equal(timers[1].canceled, true);
});

test('Quit during crash backoff cancels the timer and leaves the project stopped', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-quit-backoff-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'node_modules'));
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  const children = [];
  const timers = [];
  const manager = createProcessManager({
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.exitCode = null;
      children.push(child);
      return child;
    },
    checkPort: async () => false,
    scheduleTimeout: (callback) => {
      const timer = { callback };
      timers.push(timer);
      return timer;
    },
    clearScheduledTimeout: (timer) => {
      timer.canceled = true;
    }
  });
  const project = { id: 'one', name: 'one', path: directory, port: 3000, autoRestart: true };

  manager.startProject('one', project);
  children[0].emit('close', 1);
  assert.equal(manager.getPhase('one'), 'backoff');
  assert.equal(manager.hasRunningProcesses(), true);
  await manager.stopAllProjects();
  assert.equal(timers[0].canceled, true);
  assert.equal(manager.getPhase('one'), 'stopped');
  timers[0].callback();
  assert.equal(children.length, 1);
});
