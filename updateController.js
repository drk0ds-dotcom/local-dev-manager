const { configureUpdater } = require('./updaterPolicy');

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

function createUpdateController({
  isPackaged,
  loadUpdater,
  dialog,
  getWindow,
  msg,
  onError,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}) {
  let updater = null;
  let timer = null;
  let started = false;

  async function check() {
    if (!updater) return;
    try {
      await updater.checkForUpdates();
    } catch (error) {
      onError(error);
    }
  }

  async function start() {
    if (started || !isPackaged) return;
    started = true;
    try {
      updater = loadUpdater();
      configureUpdater(updater, {
        confirmDownload: async (info) => {
          const { response } = await dialog.showMessageBox(getWindow(), {
            type: 'question',
            title: msg('updateAvailableTitle'),
            message: msg('updateAvailableMsg', info.version),
            buttons: [msg('downloadUpdate'), msg('later')],
            defaultId: 1,
            cancelId: 1
          });
          return response === 0;
        },
        confirmInstall: async () => {
          const { response } = await dialog.showMessageBox(getWindow(), {
            type: 'info',
            title: msg('updateDownloadedTitle'),
            message: msg('updateDownloadedMsg'),
            buttons: [msg('restartNow'), msg('later')],
            defaultId: 1,
            cancelId: 1
          });
          return response === 0;
        },
        onError
      });
      await check();
      timer = setIntervalFn(check, CHECK_INTERVAL_MS);
    } catch (error) {
      onError(error);
    }
  }

  function stop() {
    if (timer !== null) clearIntervalFn(timer);
    timer = null;
  }

  return { start, check, stop };
}

module.exports = { createUpdateController };
