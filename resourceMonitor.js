const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function collectPosixTreeStats(rootPid, { pidtree, pidusage }) {
  const descendants = await pidtree(rootPid);
  const pids = [rootPid, ...descendants];
  const usage = await pidusage(pids);
  return pids.reduce(
    (total, pid) => ({
      cpu: total.cpu + (usage[pid]?.cpu || 0),
      memory: total.memory + (usage[pid]?.memory || 0)
    }),
    { cpu: 0, memory: 0 }
  );
}

function aggregateWindowsTreeStats(rootPid, current, previous, elapsedMs) {
  const byPid = new Map(current.map((entry) => [Number(entry.ProcessId), entry]));
  const oldByPid = new Map(previous.map((entry) => [Number(entry.ProcessId), entry]));
  if (!byPid.has(Number(rootPid))) return null;

  const children = new Map();
  for (const entry of current) {
    const parent = Number(entry.ParentProcessId);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(Number(entry.ProcessId));
  }

  let cpu = 0;
  let memory = 0;
  const visited = new Set();
  const stack = [Number(rootPid)];
  while (stack.length) {
    const pid = stack.pop();
    if (visited.has(pid)) continue;
    visited.add(pid);
    const entry = byPid.get(pid);
    if (!entry) continue;
    memory += Number(entry.WorkingSetSize) || 0;
    const old = oldByPid.get(pid);
    if (old && old.CreationDate === entry.CreationDate && elapsedMs > 0) {
      const currentTime = Number(entry.KernelModeTime) + Number(entry.UserModeTime);
      const oldTime = Number(old.KernelModeTime) + Number(old.UserModeTime);
      cpu += Math.max(0, currentTime - oldTime) / (elapsedMs * 100);
    }
    stack.push(...(children.get(pid) || []));
  }
  return { cpu, memory };
}

async function captureWindowsSnapshot() {
  const command =
    '$ErrorActionPreference="Stop"; Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime,CreationDate | Select-Object ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime,CreationDate | ConvertTo-Json -Compress';
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 5 * 1024 * 1024
  });
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function createResourceMonitor({
  platform = process.platform,
  captureWindowsSnapshot: capture = captureWindowsSnapshot,
  now = Date.now,
  pidtree,
  pidusage
} = {}) {
  let previous = [];
  let previousTime = 0;
  return {
    async sample(runningPids) {
      if (platform === 'win32') {
        const current = await capture();
        const time = now();
        const results = {};
        for (const [id, pid] of Object.entries(runningPids)) {
          const stats = aggregateWindowsTreeStats(pid, current, previous, time - previousTime);
          if (stats) results[id] = stats;
        }
        previous = current;
        previousTime = time;
        return results;
      }
      const listDescendants = pidtree || require('pidtree');
      const readUsage = pidusage || require('pidusage');
      const results = {};
      for (const [id, pid] of Object.entries(runningPids)) {
        results[id] = await collectPosixTreeStats(pid, { pidtree: listDescendants, pidusage: readUsage });
      }
      return results;
    }
  };
}

module.exports = { collectPosixTreeStats, aggregateWindowsTreeStats, captureWindowsSnapshot, createResourceMonitor };
