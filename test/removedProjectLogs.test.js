const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLogService } = require('../logService');

test('late output from a removed project does not recreate its disk log', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-dev-manager-removed-log-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const known = new Set(['project']);
  const delivered = [];
  const logs = createLogService({
    directory,
    cap: 500,
    isKnownId: (id) => known.has(id),
    send: (channel, entry) => delivered.push([channel, entry])
  });

  logs.append('project', 'log', 'before removal');
  known.delete('project');
  await logs.remove('project');
  logs.append('project', 'log', 'late close');
  await logs.close();
  logs.append('project', 'log', 'even later close');

  assert.equal(fs.existsSync(path.join(directory, 'project.log')), false);
  assert.equal(Object.hasOwn(logs.snapshot(), 'project'), false);
  assert.equal(delivered.length, 1);
});
