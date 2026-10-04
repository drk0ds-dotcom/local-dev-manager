const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProcessManager } = require('../processManager');
const { isPackageManagerAvailable } = require('../packageManagerAvailability');

async function waitFor(predicate, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

for (const [name, version, binVariable] of [
  ['yarn', '1.22.22', 'LDM_YARN_BIN_DIR'],
  ['bun', '1.4.2', 'LDM_BUN_BIN_DIR']
]) {
  test(
    `a real ${name} project serves HTTP and stops cleanly`,
    { skip: !process.env[binVariable], timeout: 180000 },
    async (t) => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), `ldm-${name}-server-`));
      const previousPath = process.env.PATH;
      process.env.PATH = `${process.env[binVariable]}${path.delimiter}${previousPath}`;
      const manager = createProcessManager();
      t.after(async () => {
        await manager.stopAllProjects();
        process.env.PATH = previousPath;
        fs.rmSync(directory, { recursive: true, force: true });
      });
      fs.mkdirSync(path.join(directory, 'node_modules'));
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({
          name: `ldm-${name}-test`,
          version: '1.0.0',
          private: true,
          packageManager: `${name}@${version}`,
          scripts: { dev: 'node server.js' }
        })
      );
      fs.writeFileSync(
        path.join(directory, 'server.js'),
        [
          "const http = require('node:http');",
          'const port = Number(process.env.PORT);',
          `http.createServer((_req, res) => res.end('${name.toUpperCase()}_OK')).listen(port, '127.0.0.1', () => console.log('${name.toUpperCase()}_READY'));`
        ].join('\n')
      );
      const port = await manager.findFreePort(name === 'yarn' ? 46100 : 46200);
      const logs = [];
      manager.setLogSink((_id, _type, message) => logs.push(message));
      const project = { id: `${name}-server`, name: `${name} server`, path: directory, port, script: 'dev' };

      assert.equal(manager.detectPackageManager(directory), name);
      assert.equal(await isPackageManagerAvailable(name), true);
      manager.startProject(project.id, project);
      await waitFor(
        () => manager.getStatus(project.id) === 'running',
        `${name} running; status=${manager.getStatus(project.id)}; logs=${logs.join(' | ')}`,
        120000
      );
      assert.ok(logs.some((line) => line.includes(`${name.toUpperCase()}_READY`)));
      const response = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), `${name.toUpperCase()}_OK`);
      manager.stopProject(project.id, project);
      await waitFor(() => manager.getStatus(project.id) === 'stopped', `${name} stopped`);
      await waitFor(async () => !(await manager.isPortInUse(port)), `${name} port released`, 10000);
    }
  );
}
