const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('sandboxed preload obtains the log limit from main without importing local modules', () => {
  let exposedApi;
  let requestedChannel;
  const electron = {
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        assert.equal(name, 'api');
        exposedApi = api;
      }
    },
    ipcRenderer: {
      send() {},
      invoke() {},
      on() {},
      removeListener() {},
      sendSync(channel) {
        requestedChannel = channel;
        return 500;
      }
    }
  };
  const preloadPath = path.join(__dirname, '..', 'preload.js');
  const source = fs.readFileSync(preloadPath, 'utf8');

  vm.runInNewContext(
    source,
    {
      require: (id) => {
        assert.equal(id, 'electron', 'sandboxed preload cannot import local modules');
        return electron;
      }
    },
    { filename: preloadPath }
  );

  assert.equal(requestedChannel, 'get-log-cap');
  assert.equal(exposedApi.logCap, 500);
});
