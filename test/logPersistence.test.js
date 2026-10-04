const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLogPersistence } = require('../logPersistence');

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-logs-'));
  const store = createLogPersistence({ directory, cap: 500, ...options });
  t.after(async () => {
    await store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, store };
}

test('many log lines are appended in one asynchronous disk write', async (t) => {
  let diskWrites = 0;
  const fileSystem = {
    ...fs,
    promises: {
      ...fs.promises,
      appendFile: async (...args) => {
        diskWrites++;
        return fs.promises.appendFile(...args);
      }
    }
  };
  const { directory, store } = fixture(t, { fileSystem });
  for (let i = 0; i < 10; i++) store.append('project-1', { type: 'log', message: `line ${i}` }, []);
  await store.flush();
  const lines = fs.readFileSync(path.join(directory, 'project-1.log'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 10);
  assert.equal(JSON.parse(lines[9]).message, 'line 9');
  assert.equal(diskWrites, 1);
});

test('clear and remove cannot be undone by queued writes', async (t) => {
  const { directory, store } = fixture(t);
  store.append('clear-me', { type: 'log', message: 'old' }, []);
  await store.clear('clear-me');
  assert.equal(fs.readFileSync(path.join(directory, 'clear-me.log'), 'utf8'), '');

  store.append('remove-me', { type: 'log', message: 'old' }, []);
  await store.remove('remove-me');
  assert.equal(fs.existsSync(path.join(directory, 'remove-me.log')), false);
});

test('close flushes the final queued line', async (t) => {
  const { directory, store } = fixture(t);
  store.append('last', { type: 'log', message: 'final' }, []);
  await store.close();
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'last.log'), 'utf8').trim()).message, 'final');
});

test('close includes lines that arrive while a previous batch is writing', async (t) => {
  let releaseWrite;
  const gate = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  let startedWrite;
  const started = new Promise((resolve) => {
    startedWrite = resolve;
  });
  let first = true;
  const fileSystem = {
    ...fs,
    promises: {
      ...fs.promises,
      appendFile: async (...args) => {
        if (first) {
          first = false;
          startedWrite();
          await gate;
        }
        return fs.promises.appendFile(...args);
      }
    }
  };
  const { directory, store } = fixture(t, { fileSystem });
  store.append('late', { type: 'log', message: 'first' }, []);
  const closing = store.close();
  await started;
  store.append('late', { type: 'log', message: 'second' }, []);
  releaseWrite();
  await closing;
  const lines = fs.readFileSync(path.join(directory, 'late.log'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    lines.map((entry) => entry.message),
    ['first', 'second']
  );
});

test('log compaction keeps only the configured recent lines', async (t) => {
  const { directory, store } = fixture(t, { cap: 2 });
  const history = [];
  for (let i = 0; i < 4; i++) {
    const entry = { type: 'log', message: `line ${i}` };
    history.push(entry);
    if (history.length > 2) history.shift();
    store.append('compact', entry, history);
  }
  await store.flush();
  const lines = fs.readFileSync(path.join(directory, 'compact.log'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    lines.map((entry) => entry.message),
    ['line 2', 'line 3']
  );
});
