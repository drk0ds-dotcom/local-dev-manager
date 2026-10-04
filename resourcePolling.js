const { normalizeResourceReadings } = require('./resourceReadings');

function createResourcePolling({
  monitor,
  getRunningPids,
  getWindow,
  onError,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}) {
  let polling = false;
  let errorLogged = false;
  let timer = null;

  function deliver(win, runningPids, results) {
    if (win.isDestroyed()) return;
    for (const stats of normalizeResourceReadings(runningPids, results)) {
      win.webContents.send('project-stats', stats);
    }
  }

  async function poll() {
    const win = getWindow();
    if (!win || win.isDestroyed() || polling) return;
    const runningPids = getRunningPids();
    if (!Object.keys(runningPids).length) return;

    polling = true;
    try {
      const results = await monitor.sample(runningPids);
      deliver(win, runningPids, results);
      errorLogged = false;
    } catch (error) {
      deliver(win, runningPids, null);
      if (!errorLogged) {
        onError(error);
        errorLogged = true;
      }
    } finally {
      polling = false;
    }
  }

  function start() {
    if (timer === null) timer = setIntervalFn(poll, 3000);
  }

  function stop() {
    if (timer !== null) clearIntervalFn(timer);
    timer = null;
  }

  return { poll, start, stop };
}

module.exports = { createResourcePolling };
