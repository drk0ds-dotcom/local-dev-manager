const spawn = require('cross-spawn');

function openInCode(folder, onError, spawnCommand = spawn) {
  let failed = false;
  const proc = spawnCommand('code', [folder], { shell: false, windowsHide: true });
  proc.once('error', (error) => {
    failed = true;
    onError(error);
  });
  proc.once('close', (code) => {
    if (!failed && code !== 0) onError(new Error(`VS Code exited with code ${code}`));
  });
  return proc;
}

module.exports = { openInCode };
