const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const gate = path.join(__dirname, '..', 'scripts', 'assert-ci-test-results.cjs');

test('CI test gate rejects a TAP run with skipped tests', () => {
  const result = spawnSync(process.execPath, [gate], {
    input: 'TAP version 13\n# tests 2\n# pass 1\n# fail 0\n# skipped 1\n# cancelled 0\n# todo 0\n',
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 skipped test/);
});

test('CI test gate rejects incomplete output without a final summary', () => {
  const result = spawnSync(process.execPath, [gate], {
    input: 'TAP version 13\n# Subtest: unfinished\n',
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /complete test summary/);
});

test('CI test gate rejects a TAP run with failed tests', () => {
  const result = spawnSync(process.execPath, [gate], {
    input: 'TAP version 13\n# tests 2\n# pass 1\n# fail 1\n# cancelled 0\n# skipped 0\n',
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 failed test/);
});

test('CI test gate accepts a complete run with no failed or skipped tests', () => {
  const input = 'TAP version 13\n# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n';
  const result = spawnSync(process.execPath, [gate], { input, encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, input);
  assert.equal(result.stderr, '');
});

test('CI test gate rejects a cancelled test run', () => {
  const result = spawnSync(process.execPath, [gate], {
    input: 'TAP version 13\n# tests 2\n# pass 1\n# fail 0\n# cancelled 1\n# skipped 0\n',
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cancelled test/);
});
