const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
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
    'dist/Local-Dev-Manager-Setup-1.0.0.exe',
    'projects.json',
    '.env.local',
    'certificates/release.pem',
    'certificates/release.key',
    'certificates/release.pfx',
    'vibe_images/mockup.png',
    'assets/icon-original-backup.png',
    'assets/icon-v1-cleaned.png',
    'assets/icon-v2.png',
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

test('package metadata sends updates to the approved public repository', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'local-dev-manager');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.build.productName, 'Local Dev Manager');
  assert.equal(manifest.author, 'Burayk');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.repository.url, 'https://github.com/drk0ds-dotcom/local-dev-manager.git');
  assert.equal(manifest.homepage, 'https://github.com/drk0ds-dotcom/local-dev-manager#readme');
  assert.equal(manifest.bugs.url, 'https://github.com/drk0ds-dotcom/local-dev-manager/issues');
  assert.deepEqual(manifest.build.publish, [{
    provider: 'github', owner: 'drk0ds-dotcom', repo: 'local-dev-manager'
  }]);
});

test('MIT license credits Burayk in 2026', () => {
  const license = fs.readFileSync(path.join(repositoryRoot, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License\s+/);
  assert.match(license, /Copyright \(c\) 2026 Burayk/);
  assert.match(license, /Permission is hereby granted, free of charge/);
});
