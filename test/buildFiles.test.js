const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function includedByBuildFiles(relativePath) {
  return manifest.build.files.some((entry) => {
    const pattern = entry.replaceAll('\\', '/');
    return pattern === relativePath || (pattern.endsWith('/**') && relativePath.startsWith(pattern.slice(0, -2)));
  });
}

function localRequiresFrom(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const imports = [...source.matchAll(/\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g)];
  return imports.map((match) => require.resolve(path.resolve(path.dirname(filePath), match[1])));
}

test('every locally required runtime module is included in the installer', () => {
  const pending = [manifest.main, 'preload.js'].map((name) => path.join(root, name));
  const visited = new Set();

  while (pending.length) {
    const filePath = pending.pop();
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    const relativePath = path.relative(root, filePath).replaceAll('\\', '/');
    assert.equal(includedByBuildFiles(relativePath), true, `${relativePath} is omitted from build.files`);
    pending.push(...localRequiresFrom(filePath));
  }
});

test('installer includes the main icon and fonts, but excludes backup icons', () => {
  assert.equal(includedByBuildFiles('assets/icon.png'), true);
  assert.equal(includedByBuildFiles('assets/fonts/tajawal-arabic-400-normal.woff2'), true);
  assert.equal(includedByBuildFiles('assets/icon-original-backup.png'), false);
  assert.equal(includedByBuildFiles('assets/icon-v1-cleaned.png'), false);
  assert.equal(includedByBuildFiles('assets/icon-v2.png'), false);
});
