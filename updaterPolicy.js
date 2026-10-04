function configureUpdater(updater, { confirmDownload, confirmInstall, onError }) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  let downloadPending = false;

  updater.on('update-available', async (info) => {
    if (downloadPending) return;
    downloadPending = true;
    try {
      if (await confirmDownload(info)) await updater.downloadUpdate();
    } catch (error) {
      onError(error);
    } finally {
      downloadPending = false;
    }
  });

  updater.on('update-downloaded', async () => {
    try {
      if (await confirmInstall()) updater.quitAndInstall();
    } catch (error) {
      onError(error);
    }
  });

  updater.on('error', onError);
}

module.exports = { configureUpdater };
