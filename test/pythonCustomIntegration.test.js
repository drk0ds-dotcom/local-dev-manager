const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProcessManager } = require('../processManager');

async function waitFor(predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for the expected process state');
}

test(
  'a real Python worker accepts stdin, logs output, and stops without a port',
  {
    skip: !process.env.LDM_PYTHON_EXE
  },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-python-worker-'));
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.writeFileSync(
      path.join(directory, 'worker.py'),
      'import sys\nprint("PYTHON_READY", flush=True)\nfor line in sys.stdin:\n print("ECHO:" + line.strip(), flush=True)\n'
    );
    const logs = [];
    manager.setLogSink((_id, _type, message) => logs.push(message));
    const project = {
      id: 'python-worker',
      name: 'Python worker',
      path: directory,
      port: null,
      customCommand: `"${process.env.LDM_PYTHON_EXE}" worker.py`
    };

    manager.startProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'running' && logs.includes('PYTHON_READY'));
    assert.equal(manager.writeStdin(project.id, 'hello'), true);
    await waitFor(() => logs.includes('ECHO:hello'));
    manager.stopProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'stopped');
  }
);

test(
  'a real Python HTTP server becomes ready only on its configured port',
  {
    skip: !process.env.LDM_PYTHON_EXE
  },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-python-server-'));
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.writeFileSync(
      path.join(directory, 'server.py'),
      'import http.server, os\nserver = http.server.HTTPServer(("127.0.0.1", int(os.environ["PORT"])), http.server.SimpleHTTPRequestHandler)\nprint("SERVER_READY", flush=True)\nserver.serve_forever()\n'
    );
    const port = await manager.findFreePort(43000);
    const project = {
      id: 'python-server',
      name: 'Python server',
      path: directory,
      port,
      customCommand: `"${process.env.LDM_PYTHON_EXE}" server.py`
    };

    manager.startProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'running');
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    manager.stopProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'stopped');
  }
);

test(
  'a failing real Python command enters auto-restart backoff and Stop cancels it',
  { skip: !process.env.LDM_PYTHON_EXE },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-python-crash-'));
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.writeFileSync(
      path.join(directory, 'crash.py'),
      'import sys\nprint("INTENTIONAL_CRASH", flush=True)\nsys.exit(1)\n'
    );
    const logs = [];
    manager.setLogSink((_id, _type, message) => logs.push(message));
    const project = {
      id: 'python-crash',
      name: 'Python crash',
      path: directory,
      port: null,
      autoRestart: true,
      customCommand: `"${process.env.LDM_PYTHON_EXE}" crash.py`
    };
    manager.startProject(project.id, project);
    await waitFor(() => logs.some((line) => line.includes('INTENTIONAL_CRASH')));
    await waitFor(() => manager.getPhase(project.id) === 'backoff');
    manager.stopProject(project.id, project);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal(logs.filter((line) => line.includes('INTENTIONAL_CRASH')).length, 1);
    assert.equal(manager.getStatus(project.id), 'stopped');
  }
);
