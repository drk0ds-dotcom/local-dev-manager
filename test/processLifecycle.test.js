const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const net = require('node:net');

test('Stop cannot become Running again while the child is awaiting close', { timeout: 3000 }, async (t) => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const child = new EventEmitter();
  child.pid = 9876;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  t.after(() => {
    child.exitCode = 0;
    child.emit('close', 0);
  });

  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn') return () => child;
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  const project = {
    id: 'stopping',
    name: 'Stopping',
    path: 'fixture',
    port: server.address().port,
    script: 'dev',
    autoRestart: false
  };
  manager.launchDevServer(project.id, project);
  manager.stopProject(project.id, project);
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(manager.getStatus(project.id), 'stopped');
});

test('an asynchronous stdin failure is reported and prevents further input', (t) => {
  const child = new EventEmitter();
  child.pid = 7654;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.writable = true;
  child.stdin.write = () => true;
  t.after(() => {
    child.exitCode = 0;
    child.emit('close', 0);
  });

  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn') return () => child;
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  const logs = [];
  manager.setLogSink((id, type, message) => logs.push({ id, type, message }));
  const project = {
    id: 'stdin-failure',
    name: 'Stdin Failure',
    path: 'fixture',
    port: 43129,
    script: 'dev',
    autoRestart: false
  };
  manager.launchDevServer(project.id, project);
  assert.equal(manager.writeStdin(project.id, 'hello'), true);
  assert.doesNotThrow(() => child.stdin.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' })));
  assert.equal(manager.writeStdin(project.id, 'again'), false);
  assert.ok(
    logs.some((entry) => entry.id === project.id && entry.type === 'error' && /broken pipe/.test(entry.message))
  );
});

test('split stdout chunks are emitted as one complete log line', (t) => {
  const child = new EventEmitter();
  child.pid = 7655;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  t.after(() => {
    child.exitCode = 0;
    child.emit('close', 0);
  });

  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn') return () => child;
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  const logs = [];
  manager.setLogSink((_id, _type, message) => logs.push(message));
  const project = {
    id: 'split-output',
    name: 'Split Output',
    path: 'fixture',
    port: 43130,
    script: 'dev',
    autoRestart: false
  };
  manager.launchDevServer(project.id, project);
  child.stdout.emit('data', Buffer.from('Local: http://local'));
  child.stdout.emit('data', Buffer.from('host:43130\n'));
  assert.equal(logs.filter((line) => line.includes('Local:')).length, 1);
  assert.ok(logs.includes('Local: http://localhost:43130'));
});

test('Stop All leaves an interrupted dependency installer stopped', async () => {
  const installer = new EventEmitter();
  installer.pid = 7656;
  installer.exitCode = null;
  installer.stdout = new EventEmitter();
  installer.stderr = new EventEmitter();

  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn') return () => installer;
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs')
      return {
        existsSync: (file) => !file.endsWith('node_modules'),
        readFileSync: () => '{"scripts":{"dev":"node server.js"}}'
      };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  const project = {
    id: 'install-stop',
    name: 'Install Stop',
    path: 'fixture',
    port: 43131,
    script: 'dev',
    autoRestart: false
  };
  manager.startProject(project.id, project);
  assert.equal(manager.getStatus(project.id), 'booting');
  await manager.stopAllProjects();
  installer.exitCode = 1;
  installer.emit('close', 1);
  assert.equal(manager.getStatus(project.id), 'stopped');
});

test('removing a crashed project clears its pending restart and status', async (t) => {
  const children = [];
  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn')
      return () => {
        const child = new EventEmitter();
        child.pid = 7700 + children.length;
        child.exitCode = null;
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        children.push(child);
        return child;
      };
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  t.after(async () => {
    await manager.stopAllProjects();
    for (const child of children) {
      if (child.exitCode === null) {
        child.exitCode = 0;
        child.emit('close', 0);
      }
    }
  });
  const project = {
    id: 'remove-crashed',
    name: 'Remove Crashed',
    path: 'fixture',
    port: 43132,
    script: 'dev',
    autoRestart: true
  };
  manager.launchDevServer(project.id, project);
  children[0].exitCode = 1;
  children[0].emit('close', 1);
  assert.equal(manager.getStatus(project.id), 'booting');
  manager.forgetProject(project.id, project);
  assert.equal(manager.getStatus(project.id), 'stopped');
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(children.length, 1);
});

test('Restart does not launch a replacement until the old process closes', { timeout: 7000 }, async (t) => {
  const processes = [];
  const fakeSpawn = () => {
    const child = new EventEmitter();
    child.pid = 8000 + processes.length;
    child.exitCode = null;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    processes.push(child);
    return child;
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  const loaded = { exports: {} };
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn') return fakeSpawn;
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);

  const manager = loaded.exports.createProcessManager();
  const project = {
    id: 'slow-close',
    name: 'Slow Close',
    path: 'fixture',
    port: 43127,
    script: 'dev',
    autoRestart: false
  };
  t.after(async () => {
    for (const child of processes.slice()) {
      if (child.exitCode === null) {
        child.exitCode = 0;
        child.emit('close', 0);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    for (const child of processes) {
      if (child.exitCode === null) {
        child.exitCode = 0;
        child.emit('close', 0);
      }
    }
  });

  manager.launchDevServer(project.id, project);
  manager.restartProject(project.id, project);
  await new Promise((resolve) => setTimeout(resolve, 3500));
  assert.equal(processes.length, 1);
  assert.equal(manager.getStatus(project.id), 'stopped');
  await manager.stopAllProjects();
  processes[0].exitCode = 0;
  processes[0].emit('close', 0);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(processes.length, 1, 'Stop All must cancel a restart waiting for close');
});

test('a late close from an old process cannot erase the newer process', { timeout: 7000 }, async (t) => {
  const children = [];
  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'processManager.js'), 'utf8');
  vm.runInNewContext(
    `(function(require,module){${source}\n})`,
    {
      process: { platform: 'win32', env: {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      console
    },
    { filename: 'processManager.js' }
  )((name) => {
    if (name === 'cross-spawn')
      return () => {
        const child = new EventEmitter();
        child.pid = 9000 + children.length;
        child.exitCode = null;
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        children.push(child);
        return child;
      };
    if (name === 'child_process') return { exec: (_command, _options, callback) => callback() };
    if (name === 'fs') return { existsSync: () => true, readFileSync: () => '{"scripts":{"dev":"node server.js"}}' };
    if (name === './restartPolicy') return require('../restartPolicy');
    if (name === './messages') return require('../messages');
    return require(name);
  }, loaded);
  const manager = loaded.exports.createProcessManager();
  const project = {
    id: 'late-close',
    name: 'Late Close',
    path: 'fixture',
    port: 43128,
    script: 'dev',
    autoRestart: false
  };
  t.after(() => {
    for (const child of children) {
      if (child.exitCode === null) {
        child.exitCode = 0;
        child.emit('close', 0);
      }
    }
  });

  manager.launchDevServer(project.id, project);
  const old = children[0];
  await manager.stopAllProjects();
  manager.launchDevServer(project.id, project);
  const newer = children[1];
  old.exitCode = 0;
  old.emit('close', 0);
  assert.equal(manager.getRunningPids()[project.id], newer.pid);
  assert.equal(manager.getStatus(project.id), 'booting');
});
