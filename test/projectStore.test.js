const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readProjectData, writeProjectData, applyProjectChange } = require('../projectStore');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, file: path.join(dir, 'projects.json') };
}

test('a failed atomic rename preserves the last complete project list', (t) => {
  const { dir, file } = fixture(t);
  fs.writeFileSync(file, '{"old":{"name":"kept"}}');
  const failingFs = {
    ...fs,
    renameSync: () => {
      throw new Error('simulated rename failure');
    }
  };

  assert.throws(() => writeProjectData(file, { next: { name: 'new' } }, failingFs), /simulated rename failure/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"old":{"name":"kept"}}');
  assert.deepEqual(fs.readdirSync(dir), ['projects.json']);
});

test('atomic save replaces an existing project list on Windows', (t) => {
  const { dir, file } = fixture(t);
  fs.writeFileSync(file, '{"old":{"name":"before"}}');
  writeProjectData(file, { current: { name: 'after' } });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { current: { name: 'after' } });
  assert.deepEqual(fs.readdirSync(dir), ['projects.json']);
});

test('a corrupt project list is backed up and remains untouched', (t) => {
  const { dir, file } = fixture(t);
  fs.writeFileSync(file, '{broken JSON');

  const result = readProjectData(file);

  assert.equal(result.writable, false);
  assert.deepEqual(result.projects, {});
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken JSON');
  const backup = fs.readdirSync(dir).find((name) => /^projects\.json\.corrupt-/.test(name));
  assert.ok(backup);
  assert.equal(fs.readFileSync(path.join(dir, backup), 'utf8'), '{broken JSON');
  assert.equal(result.backupPath, path.join(dir, backup));
});

test('a missing project list starts empty without creating a file', (t) => {
  const { file } = fixture(t);
  const result = readProjectData(file);
  assert.deepEqual(result.projects, {});
  assert.equal(result.writable, true);
  assert.equal(fs.existsSync(file), false);
});

test('a failed save leaves the in-memory project list unchanged', (t) => {
  const { file } = fixture(t);
  const current = { kept: { name: 'kept', port: 3000 } };
  writeProjectData(file, current);
  const failingFs = {
    ...fs,
    renameSync: () => {
      throw new Error('disk unavailable');
    }
  };

  assert.throws(
    () =>
      applyProjectChange(
        current,
        (next) => {
          next.kept.port = 4000;
        },
        (next) => writeProjectData(file, next, failingFs)
      ),
    /disk unavailable/
  );
  assert.equal(current.kept.port, 3000);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).kept.port, 3000);
});
