const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProcessManager } = require('../processManager');

async function waitFor(predicate, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the Go process');
}

test(
  'a real Go HTTP server starts, serves its configured port, and stops',
  { skip: !process.env.LDM_GO_EXE, timeout: 180000 },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ldm-go-server-'));
    const manager = createProcessManager();
    t.after(async () => {
      await manager.stopAllProjects();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.writeFileSync(
      path.join(directory, 'server.go'),
      [
        'package main',
        'import ("fmt"; "net/http"; "os")',
        'func main() {',
        '  port := os.Getenv("PORT")',
        '  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "GO_OK") })',
        '  fmt.Println("GO_SERVER_READY")',
        '  if err := http.ListenAndServe("127.0.0.1:" + port, nil); err != nil { panic(err) }',
        '}'
      ].join('\n')
    );
    const port = await manager.findFreePort(46000);
    const logs = [];
    manager.setLogSink((_id, _type, message) => logs.push(message));
    const project = {
      id: 'go-server',
      name: 'Go server',
      path: directory,
      port,
      customCommand: `"${process.env.LDM_GO_EXE}" run server.go`
    };

    manager.startProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'running');
    assert.ok(logs.some((line) => line.includes('GO_SERVER_READY')));
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'GO_OK');
    manager.stopProject(project.id, project);
    await waitFor(() => manager.getStatus(project.id) === 'stopped');
    await waitFor(async () => !(await manager.isPortInUse(port)), 10000);
  }
);
