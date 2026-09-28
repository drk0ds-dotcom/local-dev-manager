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
      npmAvailable: true,
      status: 'stopped',
      win: { name: 'window' },
      isPortInUse: async (port) => {
        calls.portChecks.push(port);
        return false;
      },
      startProject: (...args) => calls.starts.push(args),
      sendLog: (...args) => calls.logs.push(args),
      npmUnavailableMessage: 'npm unavailable',
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
  const { calls, options } = createOptions({ npmAvailable: false });

  const result = await startProjectWithChecks(options);

  assert.equal(result, 'npm-unavailable');
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
