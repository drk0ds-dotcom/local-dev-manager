const fs = require('node:fs');
const path = require('node:path');

function createTrayCloseHandler({ markerPath, showNotice, hideWindow, isQuitting, onError = () => {} }) {
  let noticeSeen = fs.existsSync(markerPath);

  return (event) => {
    if (isQuitting()) return;
    event.preventDefault();

    if (!noticeSeen) {
      noticeSeen = true;
      try {
        fs.mkdirSync(path.dirname(markerPath), { recursive: true });
        fs.writeFileSync(markerPath, 'seen\n', { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') onError(error);
      }
      try {
        showNotice();
      } finally {
        hideWindow();
      }
      return;
    }

    hideWindow();
  };
}

module.exports = { createTrayCloseHandler };
