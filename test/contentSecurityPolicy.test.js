const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('local renderer uses a restrictive CSP without inline code or remote fonts', () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.doesNotMatch(html, /\bon(?:click|change|input|submit)\s*=/i);
  assert.doesNotMatch(html, /\bstyle\s*=/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  assert.match(html, /<link rel="stylesheet" href="style\.css">/);
  assert.ok(fs.existsSync(path.join(root, 'style.css')));
});
