const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveOpenPort } = require('../portState');

test('Open rejects a stale detected port without falling back to a listening configured port', async () => {
  const checked = [];
  const port = await resolveOpenPort(8080, async (candidate) => {
    checked.push(candidate);
    return candidate === 3000;
  });
  assert.equal(port, null);
  assert.deepEqual(checked, [8080]);
});

test('Open refuses to launch a browser when the active port stops listening', async () => {
  const port = await resolveOpenPort(8080, async () => false);
  assert.equal(port, null);
});
