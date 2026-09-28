const test = require('node:test');
const assert = require('node:assert/strict');

const { createRestartPolicy } = require('../restartPolicy');

test('limits consecutive crash restarts and applies the documented backoff', () => {
  const policy = createRestartPolicy();

  assert.deepEqual(policy.next('project-1'), { attempt: 1, delayMs: 1000 });
  assert.deepEqual(policy.next('project-1'), { attempt: 2, delayMs: 2000 });
  assert.deepEqual(policy.next('project-1'), { attempt: 3, delayMs: 4000 });
  assert.deepEqual(policy.next('project-1'), { attempt: 4, delayMs: 8000 });
  assert.deepEqual(policy.next('project-1'), { attempt: 5, delayMs: 10000 });
  assert.equal(policy.next('project-1'), null);
});

test('a successful start resets the consecutive crash counter', () => {
  const policy = createRestartPolicy();

  policy.next('project-1');
  policy.next('project-1');
  policy.next('project-1');
  policy.reset('project-1');

  assert.deepEqual(policy.next('project-1'), { attempt: 1, delayMs: 1000 });
});
