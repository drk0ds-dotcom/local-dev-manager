const test = require('node:test');
const assert = require('node:assert/strict');

const { createResourcePolling } = require('../resourcePolling');

test('one poll samples two running projects and reports a missing result as unavailable', async () => {
  const sent = [];
  let samples = 0;
  const win = { isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } };
  const polling = createResourcePolling({
    monitor: {
      sample: async () => {
        samples++;
        return { one: { cpu: 10, memory: 100 } };
      }
    },
    getRunningPids: () => ({ one: 11, two: 22 }),
    getWindow: () => win,
    onError: () => {}
  });

  await polling.poll();
  assert.equal(samples, 1);
  assert.deepEqual(sent, [
    ['project-stats', { id: 'one', available: true, cpu: 10, memory: 100 }],
    ['project-stats', { id: 'two', available: false }]
  ]);
});

test('poll failure clears old values and reports only the first consecutive error', async () => {
  const sent = [];
  let errors = 0;
  const win = { isDestroyed: () => false, webContents: { send: (...args) => sent.push(args) } };
  const polling = createResourcePolling({
    monitor: {
      sample: async () => {
        throw new Error('sample failed');
      }
    },
    getRunningPids: () => ({ one: 11 }),
    getWindow: () => win,
    onError: () => errors++
  });

  await polling.poll();
  await polling.poll();
  assert.equal(errors, 1);
  assert.deepEqual(sent, [
    ['project-stats', { id: 'one', available: false }],
    ['project-stats', { id: 'one', available: false }]
  ]);
});

test('a controller never schedules twice and clears its own timer', () => {
  let starts = 0;
  let cleared;
  const polling = createResourcePolling({
    monitor: { sample: async () => ({}) },
    getRunningPids: () => ({}),
    getWindow: () => null,
    onError: () => {},
    setIntervalFn: () => {
      starts++;
      return 17;
    },
    clearIntervalFn: (id) => {
      cleared = id;
    }
  });
  polling.start();
  polling.start();
  polling.stop();
  assert.equal(starts, 1);
  assert.equal(cleared, 17);
});
