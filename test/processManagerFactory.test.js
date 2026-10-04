const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

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
    scheduleTimeout: (callback) => {
      const timer = { callback };
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
  assert.equal(timers.length, 1);
  timers[0].callback();
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
    killProcessTree: (child, done) => done()
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

test('stopping and crash backoff are internal phases with unchanged UI statuses', (t) => {
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
    scheduleTimeout: (callback) => ({ callback }),
    clearScheduledTimeout: (timer) => canceled.push(timer)
  });
  const project = { id: 'shared', name: 'shared', path: directory, port: 3000, script: 'dev', autoRestart: true };

  manager.startProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'booting');
  manager.stopProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'stopping');
  assert.equal(manager.getStatus('shared'), 'stopped');
  children[0].emit('close', 0);
  assert.equal(manager.getPhase('shared'), 'stopped');

  manager.startProject('shared', project);
  children[1].emit('close', 1);
  assert.equal(manager.getPhase('shared'), 'backoff');
  assert.equal(manager.getStatus('shared'), 'booting');
  manager.stopProject('shared', project);
  assert.equal(manager.getPhase('shared'), 'stopped');
  assert.equal(canceled.length, 1);
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
