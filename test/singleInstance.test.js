const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function evaluateMain(hasLock, triggerBeforeQuit = false, pendingRestart = false) {
  const calls = [];
  const lifecycle = new Map();
  const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const fakeElectron = {
    app: {
      getPath: () => 'C:\\isolated-user-data',
      requestSingleInstanceLock: () => hasLock,
      quit: () => calls.push('quit'),
      on: (name, handler) => lifecycle.set(name, handler),
      whenReady: () => ({ then: () => {} }),
      isPackaged: false
    },
    ipcMain: { on: () => {}, handle: () => {} },
    dialog: {},
    shell: {}
  };
  const fakeFs = {
    existsSync: () => {
      calls.push('exists');
      return false;
    },
    copyFileSync: () => calls.push('copy')
  };
  const fakeProcessManager = {
    setLogSink: () => {},
    setPortSink: () => {},
    setStatusSink: () => {},
    getRunningPids: () => ({}),
    hasRunningProcesses: () => pendingRestart,
    stopAllProjects: () => {
      calls.push('stopAll');
      return Promise.resolve();
    }
  };
  vm.runInNewContext(
    source,
    {
      require(name) {
        if (name === 'electron') return fakeElectron;
        if (name === 'fs') return fakeFs;
        if (name === './processManager')
          return {
            createProcessManager: () => {
              calls.push('createManager');
              return fakeProcessManager;
            }
          };
        if (name === './projectRegistry')
          return {
            createProjectRegistry: () => ({
              load: () => calls.push('readProjects')
            })
          };
        if (name === './resourceMonitor') return { createResourceMonitor: () => ({ sample: () => {} }) };
        if (name === './logService')
          return { createLogService: () => ({ load: () => {}, close: () => calls.push('logsClose') }) };
        if (name === './resourcePolling')
          return { createResourcePolling: () => ({ start: () => calls.push('polling'), stop: () => {} }) };
        if (name.startsWith('./')) return require(path.join(__dirname, '..', name));
        return require(name);
      },
      __dirname: path.join(__dirname, '..'),
      process: { platform: 'win32', env: {} },
      setInterval: () => calls.push('polling'),
      console
    },
    { filename: 'main.js' }
  );

  if (triggerBeforeQuit) lifecycle.get('before-quit')({ preventDefault: () => calls.push('prevented') });

  return calls;
}

test('a second app instance does not read project data, logs, or start polling', () => {
  assert.deepEqual(evaluateMain(false), ['quit']);
});

test('the primary app instance still loads its projects and starts polling', () => {
  const calls = evaluateMain(true);
  assert.ok(calls.includes('readProjects'));
  assert.ok(calls.includes('polling'));
  assert.ok(calls.includes('createManager'));
  assert.equal(calls.includes('quit'), false);
});

test('the second app instance does not enter primary-process shutdown', () => {
  assert.deepEqual(evaluateMain(false, true), ['quit']);
});

test('the primary app cancels pending process work before Quit', async () => {
  const calls = evaluateMain(true, true, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(calls.indexOf('prevented') < calls.indexOf('stopAll'));
  assert.ok(calls.indexOf('stopAll') < calls.indexOf('logsClose'));
  assert.ok(calls.indexOf('logsClose') < calls.indexOf('quit'));
});
