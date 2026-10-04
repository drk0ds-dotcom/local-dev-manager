function normalizeResourceReadings(runningPids, results) {
  return Object.keys(runningPids).map((id) => {
    const stats = results?.[id];
    if (!stats || !Number.isFinite(stats.cpu) || !Number.isFinite(stats.memory) || stats.cpu < 0 || stats.memory < 0) {
      return { id, available: false };
    }
    return { id, available: true, cpu: stats.cpu, memory: stats.memory };
  });
}

module.exports = { normalizeResourceReadings };
