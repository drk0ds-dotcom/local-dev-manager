const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProjectRegistry } = require('../projectRegistry');
const { registerIpcHandlers } = require('../ipcHandlers');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-ipc-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, 'projects.json'),
    JSON.stringify({ one: { id: 'one', name: 'One', path: directory, port: 3000 } })
  );
  const registry = createProjectRegistry({ userDataDir: directory, appDir: directory });
  registry.load();
  const listeners = new Map();
  const handlers = new Map();
  const events = [];
  const ipcMain = {
    on: (channel, fn) => listeners.set(channel, fn),
    handle: (channel, fn) => handlers.set(channel, fn),
    removeListener: (channel) => listeners.delete(channel),
    removeHandler: (channel) => handlers.delete(channel)
  };
  const ports = new Map();
  const availability = { value: true };
  const logs = {
    append: (...args) => events.push(['log', ...args]),
    remove: async () => {},
    clear: async () => {},
    snapshot: () => ({})
  };
  const win = { webContents: { send: (...args) => events.push(['send', ...args]) } };
  const browser = [];
  const dialog = {
    showOpenDialog: async () => ({ canceled: true }),
    showSaveDialog: async () => ({ canceled: true }),
    showErrorBox: () => {}
  };
  const dispose = registerIpcHandlers({
    ipcMain,
    getWindow: () => win,
    registry,
    logs,
    manager: {
      getStatus: () => 'running',
      stopProject: () => {},
      restartProject: (id) => events.push(['restart', id]),
      forgetProject: () => {},
      writeStdin: () => true
    },
    tray: { refreshLanguage: () => {} },
    ports: { get: (id) => ports.get(id), set: (id, value) => ports.set(id, value), delete: (id) => ports.delete(id) },
    shell: { openExternal: (url) => browser.push(url), openPath: () => {} },
    dialog,
    fs,
    createId: () => 'new-id',
    findFreePort: async () => 3001,
    startManagedProject: async () => {},
    isPackageManagerAvailable: async (name) => {
      events.push(['package-manager-check', name]);
      return availability.value;
    },
    detectPackageManager: () => 'npm',
    openInCode: () => {},
    isPortInUse: async () => true,
    msg: (key) => key,
    setLanguage: () => {},
    logCap: 500
  });
  const emit = (channel, payload) => listeners.get(channel)?.({}, payload);
  return { directory, registry, listeners, handlers, events, ports, browser, dialog, availability, emit, dispose };
}

test('IPC adds a Node project and removes it from the persisted registry', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'new-project');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  await f.emit('add-project');
  assert.equal(f.registry.get('new-id'), undefined);
  assert.ok(f.events.some((item) => item[0] === 'send' && item[1] === 'add-project-selection'));
  f.emit('create-project', { mode: 'node', port: 3001 });
  assert.equal(f.registry.get('new-id').path, folder);
  assert.equal(f.registry.get('new-id').port, 3001);
  assert.ok(JSON.parse(fs.readFileSync(path.join(f.directory, 'projects.json'), 'utf8'))['new-id']);

  f.emit('remove-project', 'new-id');
  assert.equal(f.registry.get('new-id'), undefined);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, 'projects.json'), 'utf8'))['new-id'], undefined);
});

test('IPC adds a custom project from a folder without package.json and accepts no port', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'worker');
  fs.mkdirSync(folder);
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  await f.emit('add-project');
  const selection = f.events.find((item) => item[0] === 'send' && item[1] === 'add-project-selection')?.[2];
  assert.equal(selection.hasNodeScript, false);
  assert.equal(f.registry.get('new-id'), undefined);
  f.emit('create-project', { mode: 'custom', customCommand: '  python worker.py  ', port: null });

  assert.equal(f.registry.get('new-id').path, folder);
  assert.equal(f.registry.get('new-id').customCommand, 'python worker.py');
  assert.equal(f.registry.get('new-id').port, null);
  assert.equal(f.registry.get('new-id').autoStart, false);
  assert.equal(f.registry.get('new-id').autoRestart, false);
});

test('canceling an add-project selection writes nothing', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'worker');
  fs.mkdirSync(folder);
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  await f.emit('add-project');
  f.emit('cancel-add-project');
  f.emit('create-project', { mode: 'custom', customCommand: 'python worker.py', port: null });
  assert.equal(f.registry.get('new-id'), undefined);
});

test('custom add rejects invalid command, port, duplicate folder and forged path', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'worker');
  fs.mkdirSync(folder);
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  for (const payload of [
    { mode: 'custom', customCommand: '  ', port: null },
    { mode: 'custom', customCommand: 'x'.repeat(2049), port: null },
    { mode: 'custom', customCommand: 'python worker.py', port: 70000 },
    { mode: 'custom', customCommand: 'python worker.py', port: null, path: 'C:\\forged' }
  ]) {
    await f.emit('add-project');
    f.emit('create-project', payload);
    assert.equal(f.registry.get('new-id'), undefined);
  }
  assert.equal(f.events.filter((item) => item[0] === 'send' && item[1] === 'add-project-error').length, 4);

  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f.directory] });
  await f.emit('add-project');
  f.emit('create-project', { mode: 'custom', customCommand: 'python worker.py', port: null });
  assert.equal(f.registry.get('new-id'), undefined);
});

test('custom add accepts malformed package.json but Node mode does not', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'malformed');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'package.json'), '{invalid');
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  await f.emit('add-project');
  f.emit('create-project', { mode: 'node', port: 3001 });
  assert.equal(f.registry.get('new-id'), undefined);
  f.emit('create-project', { mode: 'custom', customCommand: 'go run .', port: null });
  assert.equal(f.registry.get('new-id').customCommand, 'go run .');
});

test('custom add rejects a selected folder removed before submission', async (t) => {
  const f = fixture(t);
  const folder = path.join(f.directory, 'removed');
  fs.mkdirSync(folder);
  f.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });

  await f.emit('add-project');
  fs.rmdirSync(folder);
  f.emit('create-project', { mode: 'custom', customCommand: 'python worker.py', port: null });
  assert.equal(f.registry.get('new-id'), undefined);
});

test('only the newest overlapping folder selection may be submitted', async (t) => {
  const f = fixture(t);
  const oldFolder = path.join(f.directory, 'old');
  const newFolder = path.join(f.directory, 'new');
  fs.mkdirSync(oldFolder);
  fs.mkdirSync(newFolder);
  const resolveDialog = [];
  f.dialog.showOpenDialog = () => new Promise((resolve) => resolveDialog.push(resolve));

  const oldRequest = f.emit('add-project');
  const newRequest = f.emit('add-project');
  resolveDialog[1]({ canceled: false, filePaths: [newFolder] });
  await newRequest;
  resolveDialog[0]({ canceled: false, filePaths: [oldFolder] });
  await oldRequest;
  f.emit('create-project', { mode: 'custom', customCommand: 'go run .', port: null });
  assert.equal(f.registry.get('new-id').path, newFolder);
});

test('IPC updates a valid port and rejects unknown project identifiers', (t) => {
  const f = fixture(t);
  f.emit('update-port', { id: 'one', port: 4000 });
  f.emit('update-port', { id: 'missing', port: 5000 });
  assert.equal(f.registry.get('one').port, 4000);
  assert.equal(f.registry.get('missing'), undefined);
  assert.equal(f.events.filter((item) => item[0] === 'send' && item[1] === 'projects-data').length, 1);
  f.dispose();
  assert.equal(f.listeners.size, 0);
});

test('Open uses only a confirmed live port and get-log-cap replies synchronously', async (t) => {
  const f = fixture(t);
  f.ports.set('one', 3000);
  await f.emit('open', { id: 'one' });
  await f.emit('open', { id: 'missing' });
  assert.deepEqual(f.browser, ['http://localhost:3000']);
  const event = {};
  f.listeners.get('get-log-cap')(event);
  assert.equal(event.returnValue, 500);
});

test('editing a running project port keeps Open on its confirmed active port', async (t) => {
  const f = fixture(t);
  f.ports.set('one', 3000);

  f.emit('update-port', { id: 'one', port: 4000 });
  await f.emit('open', { id: 'one' });

  assert.equal(f.registry.get('one').port, 4000);
  assert.deepEqual(f.browser, ['http://localhost:3000']);
});

test('Open does not launch an unconfirmed saved port even when it is listening', async (t) => {
  const f = fixture(t);

  await f.emit('open', { id: 'one' });

  assert.deepEqual(f.browser, []);
});

test('restart skips package-manager availability for custom projects but not Node projects', async (t) => {
  const f = fixture(t);
  f.registry.apply((next) => {
    next.custom = {
      id: 'custom',
      name: 'Custom',
      path: f.directory,
      port: null,
      customCommand: 'python worker.py',
      autoStart: false,
      autoRestart: false,
      script: 'dev'
    };
  });
  f.availability.value = false;

  await f.emit('restart', 'custom');
  await f.emit('restart', 'one');

  assert.ok(f.events.some((item) => item[0] === 'restart' && item[1] === 'custom'));
  assert.deepEqual(
    f.events.filter((item) => item[0] === 'package-manager-check'),
    [['package-manager-check', 'npm']]
  );
  assert.equal(
    f.events.some((item) => item[0] === 'restart' && item[1] === 'one'),
    false
  );
});

test('custom command edits persist, while invalid or Node edits do not', (t) => {
  const f = fixture(t);
  f.registry.apply((next) => {
    next.custom = { id: 'custom', name: 'Worker', path: f.directory, port: null, customCommand: 'python old.py' };
  });
  f.emit('update-custom-command', { id: 'custom', command: '  go run .  ' });
  assert.equal(f.registry.get('custom').customCommand, 'go run .');
  assert.equal(
    f.events.some((item) => item[0] === 'restart'),
    false
  );
  const writes = JSON.parse(fs.readFileSync(path.join(f.directory, 'projects.json'), 'utf8'));
  assert.equal(writes.custom.customCommand, 'go run .');
  for (const payload of [
    { id: 'custom', command: ' ' },
    { id: 'custom', command: 'x'.repeat(2049) },
    { id: 'one', command: 'go run .' },
    { id: 'unknown', command: 'go run .' }
  ])
    f.emit('update-custom-command', payload);
  assert.equal(f.registry.get('custom').customCommand, 'go run .');
  assert.equal(f.registry.get('one').customCommand, undefined);
  assert.ok(f.events.some((item) => item[0] === 'send' && item[1] === 'project-settings-error'));
});

test('only custom projects can clear their port and stale detected ports cannot be opened', async (t) => {
  const f = fixture(t);
  f.registry.apply((next) => {
    next.custom = { id: 'custom', name: 'Worker', path: f.directory, port: 3002, customCommand: 'go run .' };
  });
  f.ports.set('custom', 3002);
  f.emit('update-port', { id: 'custom', port: null });
  assert.equal(f.registry.get('custom').port, null);
  assert.equal(f.ports.has('custom'), false);
  f.ports.set('custom', 3002);
  await f.emit('open', { id: 'custom' });
  assert.deepEqual(f.browser, []);
  f.emit('update-port', { id: 'one', port: null });
  assert.equal(f.registry.get('one').port, 3000);
});
