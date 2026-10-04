const spawn = require('cross-spawn');

function isPackageManagerAvailable(name, spawnCommand = spawn) {
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(name)) return Promise.resolve(false);
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnCommand(name, ['--version'], { shell: false, windowsHide: true, stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(available);
    };
    const timer = setTimeout(() => {
      child.kill?.();
      finish(false);
    }, 5000);
    child.once('error', () => finish(false));
    child.once('close', (code) => finish(code === 0));
  });
}

module.exports = { isPackageManagerAvailable };
