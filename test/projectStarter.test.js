const test = require('node:test');
const assert = require('node:assert/strict');

const { startProjectWithChecks } = require('../projectStarter');

function createOptions(overrides = {}) {
  const calls = { starts: [], logs: [], portChecks: [] };
  const project = {
    id: 'project-1',
    name: 'Project One',
    path: 'C:\\projects\\one',
    port: 43125,
    script: 'dev'
  };

  return {
    calls,
    options: {
      id: project.id,
      project,
      packageManager: 'npm',
      isPackageManagerAvailable: async () => true,
      status: 'stopped',
      win: { name: 'window' },
      isPortInUse: async (port) => {
        calls.portChecks.push(port);
        return false;
      },
      startProject: (...args) => calls.starts.push(args),
      sendLog: (...args) => calls.logs.push(args),
      packageManagerUnavailableMessage: (name) => `${name} unavailable`,
      portBusyMessage: (port) => `port ${port} busy`,
      ...overrides
    }
  };
}

test('blocks a stopped project when its assigned port is occupied', async () => {
  const { calls, options } = createOptions({
    isPortInUse: async (port) => {
      calls.portChecks.push(port);
      return true;
    }
  });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'port-busy');
  assert.deepEqual(calls.portChecks, [43125]);
  assert.deepEqual(calls.starts, []);
  assert.deepEqual(calls.logs, [['project-1', 'error', 'port 43125 busy']]);
});

test('starts a stopped project after the shared checks pass', async () => {
  const { calls, options } = createOptions();

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'started');
  assert.deepEqual(calls.portChecks, [43125]);
  assert.equal(calls.starts.length, 1);
  assert.equal(calls.starts[0][0], 'project-1');
  assert.equal(calls.starts[0][1], options.project);
  assert.equal(calls.starts[0][2], options.win);
  assert.deepEqual(calls.logs, []);
});

test('reports an unavailable npm environment without checking the port', async () => {
  const { calls, options } = createOptions({ isPackageManagerAvailable: async () => false });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'package-manager-unavailable');
  assert.deepEqual(calls.portChecks, []);
  assert.deepEqual(calls.starts, []);
  assert.deepEqual(calls.logs, [['project-1', 'error', 'npm unavailable']]);
});

test('delegates an already running project to the process manager warning path', async () => {
  const { calls, options } = createOptions({ status: 'running' });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'already-running');
  assert.deepEqual(calls.portChecks, []);
  assert.equal(calls.starts.length, 1);
  assert.equal(calls.starts[0][0], 'project-1');
  assert.equal(calls.starts[0][1], options.project);
  assert.equal(calls.starts[0][2], options.win);
  assert.deepEqual(calls.logs, []);
});

test('a pnpm project starts when pnpm exists even if npm is unavailable', async () => {
  const { calls, options } = createOptions({
    packageManager: 'pnpm',
    isPackageManagerAvailable: async (name) => name === 'pnpm',
    packageManagerUnavailableMessage: (name) => `${name} unavailable`
  });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'started');
  assert.equal(calls.starts.length, 1);
  assert.deepEqual(calls.portChecks, [43125]);
});

test('a missing selected package manager blocks only that project', async () => {
  const { calls, options } = createOptions({
    packageManager: 'bun',
    isPackageManagerAvailable: async () => false,
    packageManagerUnavailableMessage: (name) => `${name} unavailable`
  });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'package-manager-unavailable');
  assert.deepEqual(calls.starts, []);
  assert.deepEqual(calls.portChecks, []);
  assert.deepEqual(calls.logs, [['project-1', 'error', 'bun unavailable']]);
});

test('starts a portless custom project without npm or port checks', async () => {
  const { calls, options } = createOptions({
    project: { id: 'worker', name: 'Worker', path: 'C:\\work\\worker', port: null, customCommand: 'python worker.py' },
    isPackageManagerAvailable: async () => {
      throw new Error('package manager must not be checked');
    },
    isPortInUse: async () => {
      throw new Error('port must not be checked');
    }
  });

  assert.equal(await startProjectWithChecks(options), 'started');
  assert.equal(calls.starts.length, 1);
  assert.deepEqual(calls.logs, []);
});

test('checks a configured custom port without checking npm', async () => {
  const { calls, options } = createOptions({
    project: { id: 'server', name: 'Server', path: 'C:\\work\\server', port: 5000, customCommand: 'go run .' },
    isPackageManagerAvailable: async () => {
      throw new Error('package manager must not be checked');
    }
  });

  assert.equal(await startProjectWithChecks(options), 'started');
  assert.deepEqual(calls.portChecks, [5000]);
  assert.equal(calls.starts.length, 1);
});

test('delegates an already running custom project to the process manager', async () => {
  const { calls, options } = createOptions({
    project: { id: 'worker', name: 'Worker', path: 'C:\\work\\worker', port: null, customCommand: 'python worker.py' },
    status: 'running',
    isPackageManagerAvailable: async () => {
      throw new Error('package manager must not be checked');
    }
  });

  assert.equal(await startProjectWithChecks(options), 'already-running');
  assert.equal(calls.starts.length, 1);
  assert.deepEqual(calls.portChecks, []);
});
