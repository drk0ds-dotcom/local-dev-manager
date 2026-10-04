const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProcessManager } = require('../processManager');

async function waitFor(predicate, timeoutMs = 30000, diagnostics = () => '') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for the pnpm project: ${diagnostics()}`);
}

test(
  'a real pnpm project runs its dev script, serves its port, and stops',
  { skip: process.env.LDM_PNPM_INTEGRATION !== '1', timeout: 180000 },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-pnpm-server-'));
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(directory, 'node_modules'));
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name: 'ldm-pnpm-test',
        version: '1.0.0',
        private: true,
        packageManager: 'pnpm@11.19.0',
        scripts: { dev: 'node server.js' }
      })
    );
    fs.writeFileSync(
      path.join(directory, 'server.js'),
      [
        "const http = require('node:http');",
        'const port = Number(process.env.PORT);',
        "http.createServer((_req, res) => res.end('PNPM_OK')).listen(port, '127.0.0.1', () => console.log('PNPM_READY'));"
      ].join('\n')
    );
    const port = await manager.findFreePort(46000);
    const logs = [];
    manager.setLogSink((_id, _type, message) => logs.push(message));
    const project = { id: 'pnpm-server', name: 'pnpm server', path: directory, port, script: 'dev' };

    assert.equal(manager.detectPackageManager(directory), 'pnpm');
    manager.startProject(project.id, project);
    await waitFor(
      () => manager.getStatus(project.id) === 'running',
      120000,
      () => `directory=${directory} status=${manager.getStatus(project.id)} logs=${logs.join(' | ')}`
    );
    assert.ok(logs.some((line) => line.includes('PNPM_READY')));
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'PNPM_OK');
    manager.stopProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'stopped');
    await waitFor(
      async () => !(await manager.isPortInUse(port)),
      10000,
      () => `status=${manager.getStatus(project.id)} logs=${logs.join(' | ')}`
    );
  }
);
