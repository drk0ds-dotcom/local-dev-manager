const test = require('node:test');
const assert = require('node:assert/strict');
const { configureUpdater } = require('../updaterPolicy');

test('updates are downloaded and installed only after separate user approvals', async () => {
  const handlers = {};
  let downloads = 0;
  let installs = 0;
  let downloadChoice = false;
  let installChoice = false;
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on: (name, handler) => {
      handlers[name] = handler;
    },
    downloadUpdate: async () => {
      downloads++;
    },
    quitAndInstall: () => {
      installs++;
    }
  };

  configureUpdater(updater, {
    confirmDownload: async () => downloadChoice,
    confirmInstall: async () => installChoice,
    onError: (error) => {
      throw error;
    }
  });

  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  await handlers['update-available']({ version: '2.0.0' });
  assert.equal(downloads, 0);
  downloadChoice = true;
  await handlers['update-available']({ version: '2.0.0' });
  assert.equal(downloads, 1);
  await handlers['update-downloaded']();
  assert.equal(installs, 0);
  installChoice = true;
  await handlers['update-downloaded']();
  assert.equal(installs, 1);
});
