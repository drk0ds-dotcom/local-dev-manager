const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { isPackageManagerAvailable } = require('../packageManagerAvailability');

test('only the selected package manager is probed', async () => {
  const launched = [];
  const available = await isPackageManagerAvailable('pnpm', (command, args, options) => {
    launched.push({ command, args, options });
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('close', 0));
    return child;
  });
  assert.equal(available, true);
  assert.equal(launched.length, 1);
  assert.equal(launched[0].command, 'pnpm');
  assert.deepEqual(launched[0].args, ['--version']);
  assert.equal(launched[0].options.shell, false);
});

test('a missing selected package manager is unavailable', async () => {
  const available = await isPackageManagerAvailable('bun', () => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    return child;
  });
  assert.equal(available, false);
});
