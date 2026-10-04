const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog } = require('electron');

const isolatedUserData = process.env.LDM_SMOKE_USER_DATA_DIR;
if (!isolatedUserData) throw new Error('LDM_SMOKE_USER_DATA_DIR is required');
app.setPath('userData', isolatedUserData);

const errorDialogs = [];
if (process.env.LDM_SMOKE_CORRUPT === '1') {
  dialog.showErrorBox = (title, body) => errorDialogs.push({ title, body });
}
const trayNotices = [];
if (process.env.LDM_SMOKE_TRAY === '1') {
  dialog.showMessageBoxSync = (_window, options) => {
    trayNotices.push(options);
    return 0;
  };
}

require('./main');

app.whenReady().then(() => {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) throw new Error('Main window was not created');

  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async () => {
        await document.fonts.load('400 14px Tajawal', 'العربية');
        await document.fonts.load('400 14px IBM Plex Mono', 'Console');
        const before = document.documentElement.dir;
        document.getElementById('lang-btn').click();
        const after = document.documentElement.dir;
        return {
          title: document.title,
          projects: document.querySelectorAll('#sidebar .project-item').length,
          cssLoaded: getComputedStyle(document.body).backgroundColor === 'rgb(9, 11, 16)',
          arabicFont: document.fonts.check('400 14px Tajawal', 'العربية'),
          monoFont: document.fonts.check('400 14px IBM Plex Mono', 'Console'),
          closeButton: document.getElementById('app-close').tagName,
          languageChanged: before !== after,
          arabicConsoleLabel: document.querySelector('.log-label').textContent === 'مخرجات الطرفية',
          landmarks: Boolean(document.querySelector('nav') && document.querySelector('main')),
          languageButtonNamed: Boolean(document.getElementById('lang-btn').getAttribute('aria-label')),
          searchNamed: Boolean(document.getElementById('sidebar-search').getAttribute('aria-label')),
          statusAnnounced: document.getElementById('project-status').getAttribute('role') === 'status',
          logsAnnounced: document.getElementById('logs').getAttribute('role') === 'log'
        };
      })()`);
      if (process.env.LDM_SMOKE_CORRUPT === '1') {
        const original = path.join(isolatedUserData, 'projects.json');
        const backups = fs.readdirSync(isolatedUserData).filter((name) => name.startsWith('projects.json.corrupt-'));
        result.corruptRecovery =
          errorDialogs.length === 1 &&
          errorDialogs[0].title === 'Project storage needs attention' &&
          errorDialogs[0].body.includes(original) &&
          backups.length === 1 &&
          errorDialogs[0].body.includes(backups[0]) &&
          fs.readFileSync(original, 'utf8') === '{ invalid project data' &&
          fs.readFileSync(path.join(isolatedUserData, backups[0]), 'utf8') === '{ invalid project data' &&
          result.projects === 0;
      }
      window.webContents.send('add-project-selection', {
        name: 'sample-worker',
        path: isolatedUserData,
        hasNodeScript: false,
        script: null,
        suggestedPort: null
      });
      result.customAddDialog = await window.webContents.executeJavaScript(`(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const dialog = document.getElementById('add-project-dialog');
        const command = document.getElementById('new-custom-command');
        const mode = document.getElementById('new-project-mode');
        return Boolean(dialog?.open && command && mode?.value === 'custom' &&
          document.activeElement && dialog.contains(document.activeElement) &&
          document.getElementById('new-project-warning')?.textContent);
      })()`);
      result.customAddLabels = await window.webContents.executeJavaScript(`(async () => {
        const title = document.getElementById('new-project-title');
        const arabic = title?.textContent === 'إعداد المشروع';
        document.getElementById('lang-btn').click();
        const english = title?.textContent === 'Configure project';
        document.getElementById('lang-btn').click();
        return arabic && english;
      })()`);
      result.customAddCancelled = await window.webContents.executeJavaScript(`(async () => {
        document.getElementById('new-project-cancel')?.click();
        return !document.getElementById('add-project-dialog')?.open;
      })()`);
      window.webContents.send('projects-data', {
        'smoke-project': {
          id: 'smoke-project',
          name: 'Accessible sample',
          path: isolatedUserData,
          port: 3000,
          order: 0
        }
      });
      const projectSelectIsButton = await window.webContents.executeJavaScript(`(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const button = document.querySelector('#sidebar .project-select');
        if (!button || button.tagName !== 'BUTTON') return false;
        button.focus();
        return document.activeElement === button;
      })()`);
      if (projectSelectIsButton) {
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      }
      result.keyboardAccessible =
        projectSelectIsButton &&
        (await window.webContents.executeJavaScript(`(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return document.getElementById('project-title').textContent === 'Accessible sample';
        })()`));
      window.webContents.send('project-stats', { id: 'smoke-project', available: false });
      result.unavailableStatsShown = await window.webContents.executeJavaScript(`(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return document.getElementById('project-stats').textContent.includes('غير متاح');
      })()`);
      window.webContents.send('projects-data', {
        'smoke-project': {
          id: 'smoke-project',
          name: 'Accessible sample',
          path: isolatedUserData,
          port: 3000,
          order: 0
        },
        'custom-project': {
          id: 'custom-project',
          name: 'Worker',
          path: isolatedUserData,
          port: null,
          customCommand: '<script>python worker.py</script>',
          order: 1
        }
      });
      result.customNoPort = await window.webContents.executeJavaScript(`(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return document.getElementById('project-title').textContent === 'Worker' &&
          document.getElementById('port-status').textContent.includes('منفذ') &&
          document.getElementById('project-open').disabled &&
          document.getElementById('custom-command-input')?.value === '<script>python worker.py</script>' &&
          document.querySelector('#custom-command-row script') === null;
      })()`);
      result.customNoPortEnglish = await window.webContents.executeJavaScript(`(async () => {
        document.getElementById('lang-btn').click();
        const noPort = document.getElementById('port-status').textContent === 'No port';
        const label = document.querySelector('label[for="custom-command-input"]').textContent === 'Command';
        document.getElementById('lang-btn').click();
        return noPort && label;
      })()`);
      if (process.env.LDM_SMOKE_TRAY === '1') {
        window.close();
        const firstCloseHidWindow = !window.isVisible();
        window.show();
        window.close();
        result.trayCloseNotice =
          firstCloseHidWindow &&
          !window.isVisible() &&
          trayNotices.length === 1 &&
          trayNotices[0].type === 'info' &&
          fs.readFileSync(path.join(isolatedUserData, 'tray-close-notice-seen'), 'utf8') === 'seen\n';
      }
      result.passed = !(
        !result.cssLoaded ||
        !result.arabicFont ||
        !result.monoFont ||
        !result.languageChanged ||
        !result.arabicConsoleLabel ||
        !result.landmarks ||
        !result.languageButtonNamed ||
        !result.searchNamed ||
        !result.statusAnnounced ||
        !result.logsAnnounced ||
        !result.customAddDialog ||
        !result.customAddLabels ||
        !result.customAddCancelled ||
        !result.keyboardAccessible ||
        !result.unavailableStatsShown ||
        !result.customNoPort ||
        !result.customNoPortEnglish ||
        result.closeButton !== 'BUTTON' ||
        result.projects !== 0 ||
        (process.env.LDM_SMOKE_CORRUPT === '1' && !result.corruptRecovery) ||
        (process.env.LDM_SMOKE_TRAY === '1' && !result.trayCloseNotice)
      );
      process.stdout.write(`SMOKE_RESULT ${JSON.stringify(result)}\n`);
      if (!result.passed) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`SMOKE_ERROR ${error.stack || error}\n`);
      process.exitCode = 1;
    }
    app.quit();
  });
});
