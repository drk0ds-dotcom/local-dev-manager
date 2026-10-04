const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = __dirname;
const electronPath = require('electron');
const isolatedUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-electron-smoke-'));
if (process.env.LDM_SMOKE_CORRUPT === '1') {
  fs.writeFileSync(path.join(isolatedUserData, 'projects.json'), '{ invalid project data');
}
const smokeArgs = [path.join(root, 'electron-smoke-entry.js')];
// Some constrained Windows workspaces deny Chromium's sandbox access to node_modules/electron/dist.
// This opt-in affects this disposable UI test process only, never the packaged application.
if (process.env.LDM_SMOKE_NO_SANDBOX === '1') smokeArgs.unshift('--no-sandbox');
const child = spawn(electronPath, smokeArgs, {
  cwd: root,
  env: { ...process.env, LDM_SMOKE_USER_DATA_DIR: isolatedUserData },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';
child.stdout.on('data', (chunk) => {
  output += chunk;
});
child.stderr.on('data', (chunk) => {
  errorOutput += chunk;
});
const timer = setTimeout(() => child.kill(), 20000);

child.on('close', (code) => {
  clearTimeout(timer);
  const resultLine = output.split(/\r?\n/).find((line) => line.startsWith('SMOKE_RESULT '));
  let passed = false;
  if (resultLine) {
    try {
      passed = JSON.parse(resultLine.slice('SMOKE_RESULT '.length)).passed === true;
    } catch {
      passed = false;
    }
  }
  process.stdout.write(resultLine ? `${resultLine}\n` : output);
  if (code !== 0 || !passed) {
    process.stderr.write(`Electron smoke failed (exit ${code}).\n${errorOutput}`);
    process.exitCode = 1;
  }
  try {
    fs.rmSync(isolatedUserData, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    process.stderr.write(`Could not remove isolated smoke data: ${error.message}\n`);
    process.exitCode = 1;
  }
});
