const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const prettier = require('prettier');

const root = path.resolve(__dirname, '..');

test('Prettier accepts both LF source and Windows CRLF checkout', async () => {
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8').replace(/\r?\n/g, '\n');
  const config = JSON.parse(fs.readFileSync(path.join(root, '.prettierrc.json'), 'utf8'));
  const options = { ...config, filepath: path.join(root, 'main.js') };

  assert.equal(await prettier.check(source, options), true);
  assert.equal(await prettier.check(source.replaceAll('\n', '\r\n'), options), true);
});
