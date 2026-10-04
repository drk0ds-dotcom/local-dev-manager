const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPort } = require('../processManager').createProcessManager();

test('port detection accepts server listening and local URL announcements only', () => {
  const cases = [
    ['- Local: http://localhost:3000', 3000],
    ['  ➜  Local: http://127.0.0.1:5173/', 5173],
    ['Server listening on 0.0.0.0:8080', 8080],
    ['Server listening on port 4200', 4200],
    ['Ready at http://localhost:9000', 9000],
    ['Connected to redis://localhost:6379', null],
    ['Postgres ready on 127.0.0.1:5432', null],
    ['Build completed on 2026', null],
    ['GET http://localhost:8443/health', null],
    ['http://localhost:7000', null]
  ];
  for (const [line, expected] of cases) {
    assert.equal(extractPort(line), expected, line);
  }
});
