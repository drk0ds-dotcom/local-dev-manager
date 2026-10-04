const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('the UI loads its Arabic and mono fonts from bundled licensed files', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.doesNotMatch(css, /@import|https?:\/\//i);
  const faces = css.match(/@font-face\s*\{[^}]+\}/g) || [];

  for (const weight of [400, 500, 700]) {
    assert.ok(
      faces.some((face) => face.includes("font-family: 'Tajawal';") && face.includes(`font-weight: ${weight};`))
    );
  }
  for (const weight of [400, 500]) {
    assert.ok(
      faces.some((face) => face.includes("font-family: 'IBM Plex Mono';") && face.includes(`font-weight: ${weight};`))
    );
  }

  const fontUrls = [...css.matchAll(/url\(['"]?(assets\/fonts\/[^)'" ]+\.woff2)['"]?\)/g)].map((match) => match[1]);
  assert.equal(fontUrls.length, 8);
  for (const url of fontUrls) {
    assert.ok(fs.statSync(path.join(root, url)).size > 1000, `${url} should be a nonempty bundled font`);
  }
  assert.ok(
    fs.readFileSync(path.join(root, 'assets/fonts/LICENSE-Tajawal.txt'), 'utf8').includes('SIL OPEN FONT LICENSE')
  );
  assert.ok(
    fs.readFileSync(path.join(root, 'assets/fonts/LICENSE-IBMPlexMono.txt'), 'utf8').includes('SIL OPEN FONT LICENSE')
  );
});
