const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProjectRegistry } = require('../projectRegistry');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-registry-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const userDataDir = path.join(dir, 'user-data');
  const appDir = path.join(dir, 'app');
  fs.mkdirSync(userDataDir);
  fs.mkdirSync(appDir);
  return { userDataDir, appDir };
}

test('migrates a legacy name-keyed project without deleting the old file', (t) => {
  const { userDataDir, appDir } = fixture(t);
  const legacyFile = path.join(appDir, 'projects.json');
  fs.writeFileSync(legacyFile, JSON.stringify({ dashboard: { path: 'C:\\work\\dashboard', port: 3040 } }));

  const registry = createProjectRegistry({ userDataDir, appDir, createId: () => 'generated-id' });
  registry.load();

  const project = registry.get('generated-id');
  assert.equal(project.name, 'dashboard');
  assert.equal(project.port, 3040);
  assert.equal(project.script, 'dev');
  assert.equal(registry.isWritable(), true);
  assert.ok(fs.existsSync(legacyFile));
  assert.ok(fs.existsSync(path.join(userDataDir, 'projects.json')));
});

test('failed persistence leaves registry and file unchanged', (t) => {
  const { userDataDir, appDir } = fixture(t);
  const file = path.join(userDataDir, 'projects.json');
  fs.writeFileSync(file, JSON.stringify({ kept: { id: 'kept', name: 'kept', path: 'C:\\work', port: 3000 } }));
  const failingFs = {
    ...fs,
    renameSync() {
      throw new Error('simulated save failure');
    }
  };
  const registry = createProjectRegistry({ userDataDir, appDir, fileSystem: failingFs });
  registry.load();

  assert.throws(
    () =>
      registry.apply((next) => {
        next.kept.port = 4000;
      }),
    /simulated save failure/
  );
  assert.equal(registry.get('kept').port, 3000);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).kept.port, 3000);
});

test('failed legacy copy reads old projects without writing to them', (t) => {
  const { userDataDir, appDir } = fixture(t);
  const legacyFile = path.join(appDir, 'projects.json');
  fs.writeFileSync(legacyFile, JSON.stringify({ kept: { id: 'kept', path: 'C:\\work', port: 3000 } }));
  const failingFs = {
    ...fs,
    copyFileSync() {
      throw new Error('simulated copy failure');
    }
  };
  const registry = createProjectRegistry({ userDataDir, appDir, fileSystem: failingFs });
  registry.load();

  assert.equal(registry.get('kept').port, 3000);
  assert.equal(registry.isWritable(), false);
  assert.ok(registry.loadIssue());
  assert.equal(registry.path(), legacyFile);
  assert.equal(fs.existsSync(path.join(userDataDir, 'projects.json')), false);
});

test('reloads a custom project without a port while excluding unrelated fields', (t) => {
  const { userDataDir, appDir } = fixture(t);
  const file = path.join(userDataDir, 'projects.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      worker: {
        id: 'worker',
        name: 'Worker',
        path: 'C:\\work\\worker',
        port: null,
        customCommand: 'python worker.py',
        unrelated: 'discard'
      }
    })
  );

  const registry = createProjectRegistry({ userDataDir, appDir });
  registry.load();

  assert.equal(registry.get('worker').port, null);
  assert.equal(registry.get('worker').customCommand, 'python worker.py');
  assert.equal(Object.hasOwn(registry.get('worker'), 'unrelated'), false);
  registry.apply((next) => {
    next.worker.group = 'jobs';
  });

  const reloaded = createProjectRegistry({ userDataDir, appDir });
  reloaded.load();
  assert.equal(reloaded.get('worker').port, null);
  assert.equal(reloaded.get('worker').customCommand, 'python worker.py');
});

test('reloads a custom project with a configured port', (t) => {
  const { userDataDir, appDir } = fixture(t);
  fs.writeFileSync(
    path.join(userDataDir, 'projects.json'),
    JSON.stringify({ server: { id: 'server', path: 'C:\\work\\server', port: 5000, customCommand: 'go run .' } })
  );

  const registry = createProjectRegistry({ userDataDir, appDir });
  registry.load();
  assert.equal(registry.get('server').port, 5000);
  assert.equal(registry.get('server').customCommand, 'go run .');
});

test('normalizes an invalid saved custom port to no port', (t) => {
  const { userDataDir, appDir } = fixture(t);
  fs.writeFileSync(
    path.join(userDataDir, 'projects.json'),
    JSON.stringify({ server: { id: 'server', path: 'C:\\work\\server', port: 70000, customCommand: 'go run .' } })
  );

  const registry = createProjectRegistry({ userDataDir, appDir });
  registry.load();
  assert.equal(registry.get('server').port, null);
});

test('does not reinterpret an invalid saved custom command as a Node project', (t) => {
  const { userDataDir, appDir } = fixture(t);
  const file = path.join(userDataDir, 'projects.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ invalid: { id: 'invalid', path: 'C:\\work\\invalid', port: 3000, customCommand: '   ' } })
  );

  const registry = createProjectRegistry({ userDataDir, appDir });
  registry.load();
  assert.equal(registry.get('invalid'), undefined);
  assert.equal(registry.isWritable(), false);
  assert.ok(registry.loadIssue());
  assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).invalid);
});
