const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createTrayController } = require('../trayController');

test('tray click restores the window and language refresh rebuilds its menu', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-tray-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const events = {};
  const menus = [];
  const windowCalls = [];
  let language = 'en';
  const window = { show: () => windowCalls.push('show'), focus: () => windowCalls.push('focus') };
  class FakeTray {
    on(event, handler) {
      events[event] = handler;
    }
    setToolTip() {}
    setContextMenu(menu) {
      menus.push(menu);
    }
  }
  const controller = createTrayController({
    app: { quit: () => {} },
    Tray: FakeTray,
    Menu: { buildFromTemplate: (items) => items },
    nativeImage: {
      createFromPath: () => ({
        isEmpty: () => false,
        resize() {
          return this;
        }
      })
    },
    iconPath: path.join(directory, 'icon.png'),
    getWindow: () => window,
    msg: (key) => `${language}:${key}`,
    stopAllProjects: () => {},
    dialog: {},
    markerPath: path.join(directory, 'seen'),
    isQuitting: () => false
  });

  controller.create();
  events.click();
  language = 'ar';
  controller.refreshLanguage();

  assert.deepEqual(windowCalls, ['show', 'focus']);
  assert.equal(menus[0][0].label, 'en:trayShow');
  assert.equal(menus[1][0].label, 'ar:trayShow');
});

test('first window close hides once with a notice, while Quit exits', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-tray-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let closeHandler;
  let hidden = 0;
  let notices = 0;
  let exits = 0;
  let quitting = false;
  let menu;
  const win = {
    on: (event, handler) => {
      if (event === 'close') closeHandler = handler;
    },
    hide: () => hidden++
  };
  class FakeTray {
    on() {}
    setToolTip() {}
    setContextMenu(value) {
      menu = value;
    }
  }
  const controller = createTrayController({
    app: {
      quit: () => {
        quitting = true;
        exits++;
      }
    },
    Tray: FakeTray,
    Menu: { buildFromTemplate: (items) => items },
    nativeImage: {
      createFromPath: () => ({
        isEmpty: () => false,
        resize() {
          return this;
        }
      })
    },
    iconPath: path.join(directory, 'icon.png'),
    getWindow: () => win,
    msg: (key) => key,
    stopAllProjects: () => {},
    dialog: { showMessageBoxSync: () => notices++ },
    markerPath: path.join(directory, 'seen'),
    isQuitting: () => quitting
  });
  controller.create();
  controller.attachCloseHandler(win);
  let prevented = 0;
  const event = { preventDefault: () => prevented++ };

  closeHandler(event);
  closeHandler(event);
  assert.equal(notices, 1);
  assert.equal(hidden, 2);
  assert.equal(prevented, 2);
  menu.at(-1).click();
  assert.equal(exits, 1);
  closeHandler(event);
  assert.equal(prevented, 2);
});
