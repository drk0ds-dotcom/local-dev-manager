const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTrayCloseHandler } = require('../trayCloseNotice');

test('the first close explains the tray once across app launches, while Quit still exits', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-tray-notice-'));
  const markerPath = path.join(directory, 'notice-seen');
  let notices = 0;
  let hides = 0;
  let quitting = false;
  const options = {
    markerPath,
    showNotice: () => notices++,
    hideWindow: () => hides++,
    isQuitting: () => quitting
  };

  try {
    const handler = createTrayCloseHandler(options);
    let prevented = 0;
    const event = { preventDefault: () => prevented++ };

    handler(event);
    assert.equal(prevented, 1);
    assert.equal(hides, 1);
    assert.equal(notices, 1);
    assert.equal(fs.existsSync(markerPath), true);

    handler(event);
    createTrayCloseHandler(options)(event);
    assert.equal(prevented, 3);
    assert.equal(hides, 3);
    assert.equal(notices, 1);

    quitting = true;
    handler(event);
    assert.equal(prevented, 3);
    assert.equal(hides, 3);
    assert.equal(notices, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
