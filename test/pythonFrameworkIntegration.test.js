const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { createProcessManager } = require('../processManager');

async function waitFor(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the Python HTTP server');
}

test(
  'real Flask and Uvicorn servers start, serve, and stop through custom commands',
  { skip: process.env.LDM_PYTHON_FRAMEWORK_TESTS !== '1' },
  async (t) => {
    assert.ok(process.env.LDM_PYTHON_EXE, 'LDM_PYTHON_EXE must point to python.exe');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-python-framework-'));
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('ldm-python-framework-'));
    const venvDir = path.join(directory, 'venv');
    const python = path.join(venvDir, 'Scripts', 'python.exe');
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    });

    const venv = spawnSync(process.env.LDM_PYTHON_EXE, ['-m', 'venv', venvDir], {
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true
    });
    assert.equal(venv.status, 0, venv.stderr || venv.error?.message);
    const install = spawnSync(python, ['-m', 'pip', 'install', '--disable-pip-version-check', 'flask', 'uvicorn'], {
      encoding: 'utf8',
      timeout: 180000,
      windowsHide: true
    });
    assert.equal(install.status, 0, install.stderr || install.error?.message);

    const fixtures = [
      {
        name: 'flask',
        source:
          'import os\nfrom flask import Flask\napp = Flask(__name__)\n@app.get("/")\ndef index(): return "FLASK_OK"\napp.run(host="127.0.0.1", port=int(os.environ["PORT"]), use_reloader=False)\n',
        body: 'FLASK_OK'
      },
      {
        name: 'uvicorn',
        source:
          'import os, uvicorn\nasync def app(scope, receive, send):\n await send({"type":"http.response.start","status":200,"headers":[]})\n await send({"type":"http.response.body","body":b"UVICORN_OK"})\nuvicorn.run(app, host="127.0.0.1", port=int(os.environ["PORT"]))\n',
        body: 'UVICORN_OK'
      }
    ];

    for (const fixture of fixtures) {
      const projectDir = path.join(directory, fixture.name);
      fs.mkdirSync(projectDir);
      fs.writeFileSync(path.join(projectDir, 'server.py'), fixture.source);
      const port = await manager.findFreePort(44000);
      const project = {
        id: fixture.name,
        name: fixture.name,
        path: projectDir,
        port,
        customCommand: `"${python}" server.py`
      };
      manager.startProject(project.id, project);
      await waitFor(() => manager.getStatus(project.id) === 'running');
      const response = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), fixture.body);
      manager.stopProject(project.id, project);
      await waitFor(() => manager.getStatus(project.id) === 'stopped');
      await waitFor(async () => !(await manager.isPortInUse(port)), 5000);
    }
  }
);
