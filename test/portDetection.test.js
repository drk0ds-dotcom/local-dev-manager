const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPort } = require('../processManager').createProcessManager();

for (const [line, expected] of [
  ['Server started on 127.0.0.1:8080', 8080],
  ['Server started on 192.168.1.5:3000', null],
  ['Server started on 2026-10-09T10:32:11Z', null],
  ['Server started on 8 worker threads', null],
  ['Server started on http://localhost:3000', 3000]
]) {
  test(`extractPort handles ${line}`, () => assert.equal(extractPort(line), expected));
}

test('port detection accepts server listening and local URL announcements only', () => {
  const cases = [
    ['- Local: http://localhost:3000', 3000],
    ['  ➜  Local: http://127.0.0.1:5173/', 5173],
    ['Server listening on 0.0.0.0:8080', 8080],
    ['Server listening on port 4200', 4200],
    ['Server started on 4902', 4902],
    ['listening on :8080', 8080],
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
