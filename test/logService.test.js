const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLogService } = require('../logService');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-logs-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('loads persisted lines and caps the visible history', (t) => {
  const directory = fixture(t);
  const entries = [
    { type: 'log', message: 'old' },
    { type: 'log', message: 'middle' },
    { type: 'log', message: 'new' }
  ];
  fs.writeFileSync(path.join(directory, 'one.log'), entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  const logs = createLogService({ directory, cap: 2, isKnownId: () => true, send: () => {} });

  logs.load();
  assert.deepEqual(logs.snapshot().one, entries.slice(-2));
});

test('system messages reach the UI without creating a disk log', async (t) => {
  const directory = fixture(t);
  const sent = [];
  const logs = createLogService({
    directory,
    cap: 2,
    isKnownId: () => false,
    send: (event, value) => sent.push([event, value])
  });

  logs.append('__system__', 'error', 'read-only');
  await logs.close();

  assert.deepEqual(sent, [['project-log', { id: '__system__', type: 'error', message: 'read-only' }]]);
  assert.deepEqual(logs.snapshot(), {});
  assert.equal(fs.existsSync(path.join(directory, '__system__.log')), false);
});

test('late child output cannot recreate the log of a removed project', async (t) => {
  const directory = fixture(t);
  const known = new Set(['one']);
  const sent = [];
  const logs = createLogService({
    directory,
    cap: 2,
    isKnownId: (id) => known.has(id),
    send: (...args) => sent.push(args)
  });

  logs.append('one', 'log', 'before');
  known.delete('one');
  await logs.remove('one');
  logs.append('one', 'log', 'late');
  await logs.close();

  assert.equal(fs.existsSync(path.join(directory, 'one.log')), false);
  assert.equal(logs.snapshot().one, undefined);
  assert.equal(sent.length, 1);
});
