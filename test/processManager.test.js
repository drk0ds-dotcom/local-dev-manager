const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  startProject,
  getStatus,
  setLogSink
} = require('../processManager');

function waitFor(predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() >= deadline) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for process output'));
      }
    }, 25);
  });
}

test('package manager launch does not emit the shell-argument security warning', { timeout: 10000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-spawn-test-'));
  const projectId = 'spawn-security-project';
  const warnings = [];
  const project = {
    id: projectId,
    name: 'Spawn Security Project',
    path: projectPath,
    port: 43122,
    script: 'dev',
    autoRestart: false
  };
  const onWarning = (warning) => warnings.push(warning);

  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
    scripts: { dev: 'node server.js' }
  }));
  fs.writeFileSync(path.join(projectPath, 'server.js'), 'process.exit(0);');

  process.on('warning', onWarning);
  setLogSink(() => {});

  t.after(() => {
    process.removeListener('warning', onWarning);
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);
  await waitFor(() => getStatus(projectId) === 'stopped');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    warnings.some((warning) => warning.code === 'DEP0190'),
    false,
    `Unexpected security warning: ${warnings.map((warning) => warning.code).join(', ')}`
  );
});

test('automatic install preserves startup without the shell-argument warning', { timeout: 20000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-install-test-'));
  const projectId = 'install-security-project';
  const warnings = [];
  const events = [];
  const project = {
    id: projectId,
    name: 'Install Security Project',
    path: projectPath,
    port: 43121,
    script: 'dev',
    autoRestart: false
  };
  const onWarning = (warning) => warnings.push(warning);

  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
    scripts: { dev: 'node server.js' }
  }));
  fs.writeFileSync(
    path.join(projectPath, 'server.js'),
    "console.log('INSTALL_PATH_SERVER_READY');"
  );

  process.on('warning', onWarning);
  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(() => {
    process.removeListener('warning', onWarning);
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);
  await waitFor(() => getStatus(projectId) === 'stopped', 15000);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    warnings.some((warning) => warning.code === 'DEP0190'),
    false,
    `Unexpected security warning: ${warnings.map((warning) => warning.code).join(', ')}`
  );
  assert.ok(events.some((event) =>
    event.id === projectId && event.message === '✅ npm install completed — starting the project...'
  ));
  assert.ok(events.some((event) =>
    event.id === projectId && event.message === 'INSTALL_PATH_SERVER_READY'
  ));
});

test('untrusted packageManager values fall back to npm instead of becoming commands', { timeout: 10000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-pm-safety-test-'));
  const projectId = 'package-manager-safety-project';
  const events = [];
  const project = {
    id: projectId,
    name: 'Package Manager Safety Project',
    path: projectPath,
    port: 43120,
    script: 'dev',
    autoRestart: false
  };

  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
    packageManager: 'npm & echo UNTRUSTED_COMMAND',
    scripts: { dev: 'node server.js' }
  }));
  fs.writeFileSync(
    path.join(projectPath, 'server.js'),
    "console.log('SAFE_PACKAGE_MANAGER_FALLBACK');"
  );

  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(() => {
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);
  await waitFor(() => getStatus(projectId) === 'stopped');

  assert.ok(events.some((event) =>
    event.id === projectId && event.message === '⚙️ npm run dev  [generic]'
  ));
  assert.ok(events.some((event) =>
    event.id === projectId && event.message === 'SAFE_PACKAGE_MANAGER_FALLBACK'
  ));
});

test('server stdout keeps the project id, type, and message', { timeout: 10000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-log-test-'));
  const projectId = 'log-contract-project';
  const project = {
    id: projectId,
    name: 'Log Contract Project',
    path: projectPath,
    port: 43123,
    script: 'dev',
    autoRestart: false
  };
  const events = [];

  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
    scripts: { dev: 'node server.js' }
  }));
  fs.writeFileSync(
    path.join(projectPath, 'server.js'),
    "console.log('SERVER_READY_FOR_LOG_TEST');"
  );

  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(async () => {
    await waitFor(() => getStatus(projectId) === 'stopped');
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);

  await waitFor(() => events.some((event) =>
    event.message === 'SERVER_READY_FOR_LOG_TEST' || typeof event.id === 'object'
  ));

  assert.ok(
    events.some((event) =>
      event.id === projectId &&
      event.type === 'log' &&
      event.message === 'SERVER_READY_FOR_LOG_TEST'
    ),
    `Expected a correctly shaped stdout event, received: ${JSON.stringify(events)}`
  );
});

test('starting an already running project emits a correctly shaped warning', { timeout: 10000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-stop-log-test-'));
  const readyPath = path.join(projectPath, 'ready.txt');
  const projectId = 'stop-log-contract-project';
  const project = {
    id: projectId,
    name: 'Stop Log Contract Project',
    path: projectPath,
    port: 43124,
    script: 'dev',
    autoRestart: false
  };
  const events = [];

  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
    scripts: { dev: 'node server.js' }
  }));
  fs.writeFileSync(
    path.join(projectPath, 'server.js'),
    `require('node:fs').writeFileSync(${JSON.stringify(readyPath)}, 'ready'); setTimeout(() => {}, 1000);`
  );

  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(async () => {
    await waitFor(() => getStatus(projectId) === 'stopped');
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);
  await waitFor(() => fs.existsSync(readyPath));

  events.length = 0;
  startProject(projectId, project);
  await waitFor(() => events.some((event) =>
    event.message === '⚠️ Project "Stop Log Contract Project" is already running' || typeof event.id === 'object'
  ));

  assert.ok(
    events.some((event) =>
      event.id === projectId &&
      event.type === 'warn' &&
      event.message === '⚠️ Project "Stop Log Contract Project" is already running'
    ),
    `Expected a correctly shaped already-running event, received: ${JSON.stringify(events)}`
  );
});
