const { createTrayCloseHandler } = require('./trayCloseNotice');

function createTrayController({
  app,
  Tray,
  Menu,
  nativeImage,
  iconPath,
  getWindow,
  msg,
  stopAllProjects,
  dialog,
  markerPath,
  isQuitting,
  onError = () => {}
}) {
  let tray = null;

  function showWindow() {
    const win = getWindow();
    win?.show();
    win?.focus();
  }

  function buildMenu() {
    return Menu.buildFromTemplate([
      { label: msg('trayShow'), click: showWindow },
      { type: 'separator' },
      { label: msg('trayStopAll'), click: () => stopAllProjects() },
      { type: 'separator' },
      { label: msg('trayQuit'), click: () => app.quit() }
    ]);
  }

  function refreshLanguage() {
    if (tray) tray.setContextMenu(buildMenu());
  }

  function create() {
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      onError(new Error('Failed to load tray icon'));
      return null;
    }
    icon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Local Dev Manager');
    refreshLanguage();
    tray.on('click', showWindow);
    return tray;
  }

  function attachCloseHandler(win) {
    win.on(
      'close',
      createTrayCloseHandler({
        markerPath,
        showNotice: () =>
          dialog.showMessageBoxSync(win, {
            type: 'info',
            title: msg('trayCloseNoticeTitle'),
            message: msg('trayCloseNoticeMessage'),
            buttons: [msg('ok')],
            defaultId: 0,
            noLink: true
          }),
        hideWindow: () => win.hide(),
        isQuitting,
        onError
      })
    );
  }

  return { create, refreshLanguage, attachCloseHandler };
}

module.exports = { createTrayController };
