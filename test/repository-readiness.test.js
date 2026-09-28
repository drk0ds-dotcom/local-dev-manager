const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');

function isIgnored(relativePath) {
  const result = spawnSync(
    'git',
    ['check-ignore', '--quiet', '--no-index', relativePath],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );

  assert.notEqual(result.status, null, result.error?.message);
  return result.status === 0;
}

test('publication-only and sensitive local files cannot enter the repository', () => {
  const excludedPaths = [
    'node_modules/example/index.js',
    'dist/Local Dev Manager Setup 1.0.0.exe',
    'projects.json',
    '.env.local',
    'certificates/release.pem',
    'certificates/release.key',
    'certificates/release.pfx',
    'vibe_images/mockup.png',
    'assets/icon-original-backup.png',
    'assets/icon-v1-cleaned.png',
    '.superpowers/sdd/progress.md'
  ];

  for (const relativePath of excludedPaths) {
    assert.equal(
      isIgnored(relativePath),
      true,
      `${relativePath} must remain outside the public repository`
    );
  }
});
