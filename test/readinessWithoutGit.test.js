const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('repository readiness runs from a source ZIP without Git metadata', (t) => {
  const root = path.resolve(__dirname, '..');
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-zip-test-'));
  t.after(() => fs.rmSync(isolated, { recursive: true, force: true }));
  fs.mkdirSync(path.join(isolated, 'test'));
  for (const file of ['package.json', 'LICENSE']) fs.copyFileSync(path.join(root, file), path.join(isolated, file));
  const manifestPath = path.join(isolated, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = '1.2.3';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.copyFileSync(
    path.join(root, 'test', 'repository-readiness.test.js'),
    path.join(isolated, 'test', 'repository-readiness.test.js')
  );

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', path.join(isolated, 'test', 'repository-readiness.test.js')], {
    cwd: isolated,
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /skipped 1/);
});
