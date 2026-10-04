const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildLaunchSpec } = require('../processManager');

const { startProject, launchDevServer, stopProject, stopAllProjects, getStatus, setLogSink, setPortSink } =
  require('../processManager').createProcessManager();

test('buildLaunchSpec uses the user command with shell and no inherited port for a portless custom project', () => {
  const spec = buildLaunchSpec(
    { customCommand: 'python worker.py', port: null, path: 'C:\\work\\worker' },
    { packageManager: null, framework: null, baseEnv: { PATH: 'C:\\tools' } }
  );

  assert.deepEqual(spec, {
    command: 'python worker.py',
    args: [],
    env: { PATH: 'C:\\tools', PYTHONUNBUFFERED: '1' },
    shell: true
  });
});

test('buildLaunchSpec passes a configured custom port without injecting Node arguments', () => {
  const spec = buildLaunchSpec(
    { customCommand: 'go run .', port: 5000 },
    { packageManager: null, framework: null, baseEnv: { TEST: 'value' } }
  );

  assert.deepEqual(spec, {
    command: 'go run .',
    args: [],
    env: { TEST: 'value', PYTHONUNBUFFERED: '1', PORT: '5000' },
    shell: true
  });
});

test('buildLaunchSpec keeps Node package-manager arguments and environment', () => {
  const spec = buildLaunchSpec(
    { script: 'dev', port: 43125 },
    { packageManager: 'npm', framework: 'next', baseEnv: { TEST: 'value' } }
  );

  assert.deepEqual(spec, {
    command: 'npm',
    args: ['run', 'dev', '--', '--port', '43125'],
    env: { TEST: 'value', VITE_PORT: '43125', PORT: '43125' },
    shell: false
  });
});

test('launchDevServer rejects a second active launch for the same project', { timeout: 8000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-double-launch-'));
  const project = {
    id: 'double-launch-project',
    name: 'Double Launch',
    path: projectPath,
    port: 43126,
    script: 'dev',
    autoRestart: false
  };
  const events = [];
  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  fs.writeFileSync(path.join(projectPath, 'server.js'), 'setTimeout(() => process.exit(0), 2000);');
  setLogSink((id, type, message) => events.push({ id, type, message }));
  t.after(async () => {
    await new Promise((resolve) => stopProject(project.id, project, undefined, resolve));
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  launchDevServer(project.id, project);
  launchDevServer(project.id, project);
  assert.equal(events.filter((event) => event.message.includes('⚙️ npm run dev')).length, 1);
});

test('Stop cancels an auto-restart scheduled after a crash', { timeout: 12000 }, async (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-stop-restart-'));
  const project = {
    id: 'stop-pending-restart',
    name: 'Stop Pending Restart',
    path: projectPath,
    port: 43125,
    script: 'dev',
    autoRestart: true
  };
  const events = [];
  fs.mkdirSync(path.join(projectPath, 'node_modules'));
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ scripts: { dev: 'node crash.js' } }));
  fs.writeFileSync(path.join(projectPath, 'crash.js'), 'process.exit(1);');
  setLogSink((id, type, message) => events.push({ id, type, message }));
  t.after(async () => {
    project.autoRestart = false;
    await new Promise((resolve) => setTimeout(resolve, 1300));
    await stopAllProjects();
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(project.id, project);
  await waitFor(() => events.some((event) => event.message.includes('auto-restarting...')));
  assert.equal(getStatus(project.id), 'booting');
  stopProject(project.id, project);
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(events.filter((event) => event.message.includes('⚙️ npm run dev')).length, 1);
});

test(
  'a port announcement does not mark the project running before the socket listens',
  { timeout: 12000 },
  async (t) => {
    const net = require('node:net');
    const reserve = net.createServer();
    await new Promise((resolve) => reserve.listen(0, '127.0.0.1', resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));

    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-port-ready-'));
    const project = {
      id: 'delayed-port-project',
      name: 'Delayed Port',
      path: projectPath,
      port,
      script: 'dev',
      autoRestart: false
    };
    const events = [];
    const ports = [];
    fs.mkdirSync(path.join(projectPath, 'node_modules'));
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
    fs.writeFileSync(
      path.join(projectPath, 'server.js'),
      `const net = require('net'); console.log('Local: http://localhost:${port}'); setTimeout(() => { const server = net.createServer(); server.listen(${port}, '127.0.0.1'); setTimeout(() => server.close(() => process.exit(0)), 3000); }, 1500);`
    );
    setLogSink((id, type, message) => events.push({ id, type, message }));
    setPortSink((id, readyPort) => ports.push({ id, port: readyPort }));
    t.after(async () => {
      await waitFor(() => getStatus(project.id) === 'stopped', 9000);
      setLogSink(() => {});
      setPortSink(() => {});
      fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    });

    startProject(project.id, project);
    await waitFor(() => events.some((event) => event.message.includes(`Local: http://localhost:${port}`))).catch(
      (err) => {
        throw new Error(`No port announcement: ${JSON.stringify(events)}`, { cause: err });
      }
    );
    assert.equal(getStatus(project.id), 'booting');
    await waitFor(() => getStatus(project.id) === 'running', 7000).catch((err) => {
      throw new Error(`Never running: ${JSON.stringify({ status: getStatus(project.id), events, ports })}`, {
        cause: err
      });
    });
    assert.deepEqual(ports, [{ id: project.id, port }]);
  }
);

test('loading the process manager does not print a startup banner', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./processManager')"], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

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
  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      scripts: { dev: 'node server.js' }
    })
  );
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

  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      scripts: { dev: 'node server.js' }
    })
  );
  fs.writeFileSync(path.join(projectPath, 'server.js'), "console.log('INSTALL_PATH_SERVER_READY');");

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
  assert.ok(
    events.some(
      (event) => event.id === projectId && event.message === '✅ npm install completed — starting the project...'
    )
  );
  assert.ok(events.some((event) => event.id === projectId && event.message === 'INSTALL_PATH_SERVER_READY'));
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
  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      packageManager: 'npm & echo UNTRUSTED_COMMAND',
      scripts: { dev: 'node server.js' }
    })
  );
  fs.writeFileSync(path.join(projectPath, 'server.js'), "console.log('SAFE_PACKAGE_MANAGER_FALLBACK');");

  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(() => {
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);
  await waitFor(() => getStatus(projectId) === 'stopped');

  assert.ok(events.some((event) => event.id === projectId && event.message === '⚙️ npm run dev  [generic]'));
  assert.ok(events.some((event) => event.id === projectId && event.message === 'SAFE_PACKAGE_MANAGER_FALLBACK'));
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
  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      scripts: { dev: 'node server.js' }
    })
  );
  fs.writeFileSync(path.join(projectPath, 'server.js'), "console.log('SERVER_READY_FOR_LOG_TEST');");

  setLogSink((id, type, message) => events.push({ id, type, message }));

  t.after(async () => {
    await waitFor(() => getStatus(projectId) === 'stopped');
    setLogSink(() => {});
    fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  startProject(projectId, project);

  await waitFor(() =>
    events.some((event) => event.message === 'SERVER_READY_FOR_LOG_TEST' || typeof event.id === 'object')
  );

  assert.ok(
    events.some(
      (event) => event.id === projectId && event.type === 'log' && event.message === 'SERVER_READY_FOR_LOG_TEST'
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
  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      scripts: { dev: 'node server.js' }
    })
  );
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
  await waitFor(() =>
    events.some(
      (event) =>
        event.message === '⚠️ Project "Stop Log Contract Project" is already running' || typeof event.id === 'object'
    )
  );

  assert.ok(
    events.some(
      (event) =>
        event.id === projectId &&
        event.type === 'warn' &&
        event.message === '⚠️ Project "Stop Log Contract Project" is already running'
    ),
    `Expected a correctly shaped already-running event, received: ${JSON.stringify(events)}`
  );
});
