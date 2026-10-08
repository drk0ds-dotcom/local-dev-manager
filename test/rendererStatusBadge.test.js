const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('status badge prefers the waiting-port text in the selected language', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');
  const start = source.indexOf('function updateStatusBadge(');
  const end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start);
  const badge = { className: '' };
  const label = { textContent: '' };
  const context = {
    document: { getElementById: (id) => (id === 'project-status' ? badge : label) },
    currentProject: 'server',
    projectBadgeText: { server: { en: 'Waiting for port 3000', ar: 'بانتظار المنفذ 3000' } },
    lang: 'en',
    t: (status) => ({ booting: 'Booting...', running: 'Running' })[status]
  };

  vm.runInNewContext(`${source.slice(start, end)}\nupdateStatusBadge('booting');`, context);
  assert.equal(label.textContent, 'Waiting for port 3000');
  context.lang = 'ar';
  vm.runInNewContext("updateStatusBadge('booting');", context);
  assert.equal(label.textContent, 'بانتظار المنفذ 3000');
  context.projectBadgeText.server = null;
  vm.runInNewContext("updateStatusBadge('running');", context);
  assert.equal(label.textContent, 'Running');
  assert.equal(badge.className, 'status-badge running');
});
