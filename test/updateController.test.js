const test = require('node:test');
const assert = require('node:assert/strict');

const { createUpdateController } = require('../updateController');

test('development mode does not load the updater or schedule checks', async () => {
  let loads = 0;
  let intervals = 0;
  const updates = createUpdateController({
    isPackaged: false,
    loadUpdater: () => {
      loads++;
    },
    dialog: {},
    getWindow: () => null,
    msg: () => '',
    onError: () => {},
    setIntervalFn: () => {
      intervals++;
    },
    clearIntervalFn: () => {}
  });

  await updates.start();
  await updates.check();
  updates.stop();
  assert.equal(loads, 0);
  assert.equal(intervals, 0);
});

test('packaged mode checks immediately, repeats at twelve hours, and clears its timer', async () => {
  const handlers = {};
  let checks = 0;
  let intervalMs;
  let cleared;
  const updater = {
    on: (name, handler) => {
      handlers[name] = handler;
    },
    checkForUpdates: async () => {
      checks++;
    }
  };
  const updates = createUpdateController({
    isPackaged: true,
    loadUpdater: () => updater,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    getWindow: () => null,
    msg: () => 'later',
    onError: () => {},
    setIntervalFn: (fn, ms) => {
      intervalMs = ms;
      return { fn };
    },
    clearIntervalFn: (timer) => {
      cleared = timer;
    }
  });

  await updates.start();
  updates.stop();

  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(checks, 1);
  assert.equal(intervalMs, 12 * 60 * 60 * 1000);
  assert.equal(typeof cleared.fn, 'function');
  assert.equal(typeof handlers['update-available'], 'function');
});
