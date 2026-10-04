const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeResourceReadings } = require('../resourceReadings');

test('missing or failed resource samples are reported unavailable instead of leaving stale values', () => {
  const runningPids = { alpha: 101, beta: 202 };
  assert.deepEqual(normalizeResourceReadings(runningPids, { alpha: { cpu: 12.5, memory: 1048576 } }), [
    { id: 'alpha', available: true, cpu: 12.5, memory: 1048576 },
    { id: 'beta', available: false }
  ]);
  assert.deepEqual(normalizeResourceReadings(runningPids, null), [
    { id: 'alpha', available: false },
    { id: 'beta', available: false }
  ]);
  assert.deepEqual(normalizeResourceReadings({ alpha: 101 }, { alpha: { cpu: NaN, memory: 2 } }), [
    { id: 'alpha', available: false }
  ]);
});
