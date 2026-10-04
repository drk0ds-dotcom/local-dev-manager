const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildRunArgs, detectFramework, killTree } = require('../processManager').createProcessManager();

test('run arguments match the package manager and framework', () => {
  assert.deepEqual(buildRunArgs('npm', 'dev', 'next', 4242), ['run', 'dev', '--', '--port', '4242']);
  assert.deepEqual(buildRunArgs('pnpm', 'dev', 'vite', 4242), ['run', 'dev', '--', '--port', '4242']);
  assert.deepEqual(buildRunArgs('yarn', 'start', 'angular', 4242), ['run', 'start', '--port', '4242']);
  assert.deepEqual(buildRunArgs('bun', 'dev', 'generic', 4242), ['run', 'dev']);
  assert.deepEqual(buildRunArgs('npm', 'start', 'cra', 4242), ['run', 'start']);
});

test('framework detection reads actual project dependencies', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-framework-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '15.0.0' } }));
  assert.equal(detectFramework(dir), 'next');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { vite: '6.0.0' } }));
  assert.equal(detectFramework(dir), 'vite');
});

test('killTree stops a disposable process spawned by this test', { timeout: 7000 }, async (t) => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  const closed = new Promise((resolve) => child.once('close', resolve));
  await new Promise((resolve) => killTree(child, resolve));
  await closed;
  assert.ok(child.exitCode !== null || child.signalCode, 'child must have exited or been signaled');
});
