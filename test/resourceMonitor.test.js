const test = require('node:test');
const assert = require('node:assert/strict');
const { collectPosixTreeStats, aggregateWindowsTreeStats, createResourceMonitor } = require('../resourceMonitor');

test('resource monitoring sums the root process and its descendants', async () => {
  const result = await collectPosixTreeStats(100, {
    pidtree: async () => [101, 102],
    pidusage: async (pids) => {
      assert.deepEqual(pids, [100, 101, 102]);
      return {
        100: { cpu: 2, memory: 1000 },
        101: { cpu: 5, memory: 2000 },
        102: { cpu: 3, memory: 500 }
      };
    }
  });
  assert.deepEqual(result, { cpu: 10, memory: 3500 });
});

test('Windows CIM snapshot measures only the project tree without wmic', () => {
  const previous = [
    { ProcessId: 100, ParentProcessId: 1, CreationDate: 'root', KernelModeTime: 10000000, UserModeTime: 0 },
    { ProcessId: 101, ParentProcessId: 100, CreationDate: 'child', KernelModeTime: 0, UserModeTime: 0 }
  ];
  const current = [
    {
      ProcessId: 100,
      ParentProcessId: 1,
      CreationDate: 'root',
      KernelModeTime: 20000000,
      UserModeTime: 0,
      WorkingSetSize: 1000
    },
    {
      ProcessId: 101,
      ParentProcessId: 100,
      CreationDate: 'child',
      KernelModeTime: 0,
      UserModeTime: 20000000,
      WorkingSetSize: 500
    },
    {
      ProcessId: 102,
      ParentProcessId: 1,
      CreationDate: 'other',
      KernelModeTime: 90000000,
      UserModeTime: 0,
      WorkingSetSize: 9000
    }
  ];
  assert.deepEqual(aggregateWindowsTreeStats(100, current, previous, 10000), { cpu: 30, memory: 1500 });
});

test('Windows CIM snapshot reports memory but no fabricated CPU on its first sample', () => {
  const current = [
    {
      ProcessId: 100,
      ParentProcessId: 1,
      CreationDate: 'root',
      KernelModeTime: 20000000,
      UserModeTime: 0,
      WorkingSetSize: 1000
    }
  ];
  assert.deepEqual(aggregateWindowsTreeStats(100, current, [], 10000), { cpu: 0, memory: 1000 });
});

test('Windows monitor samples all running projects from a single process snapshot', async () => {
  let calls = 0;
  let now = 0;
  const snapshots = [
    [
      {
        ProcessId: 100,
        ParentProcessId: 1,
        CreationDate: 'a',
        KernelModeTime: 0,
        UserModeTime: 0,
        WorkingSetSize: 1000
      },
      {
        ProcessId: 200,
        ParentProcessId: 1,
        CreationDate: 'b',
        KernelModeTime: 0,
        UserModeTime: 0,
        WorkingSetSize: 2000
      }
    ],
    [
      {
        ProcessId: 100,
        ParentProcessId: 1,
        CreationDate: 'a',
        KernelModeTime: 10000000,
        UserModeTime: 0,
        WorkingSetSize: 1200
      },
      {
        ProcessId: 200,
        ParentProcessId: 1,
        CreationDate: 'b',
        KernelModeTime: 20000000,
        UserModeTime: 0,
        WorkingSetSize: 2200
      }
    ]
  ];
  const monitor = createResourceMonitor({
    platform: 'win32',
    captureWindowsSnapshot: async () => snapshots[calls++],
    now: () => now
  });
  assert.deepEqual(await monitor.sample({ first: 100, second: 200 }), {
    first: { cpu: 0, memory: 1000 },
    second: { cpu: 0, memory: 2000 }
  });
  now = 10000;
  assert.deepEqual(await monitor.sample({ first: 100, second: 200 }), {
    first: { cpu: 10, memory: 1200 },
    second: { cpu: 20, memory: 2200 }
  });
  assert.equal(calls, 2);
});
