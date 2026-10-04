const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { openInCode } = require('../codeLauncher');

test('VS Code receives a literal folder argument without shell interpretation', () => {
  const folder = 'C:\\Users\\Gamer\\Desktop\\100% ready & safe';
  let launch;
  const process = new EventEmitter();
  openInCode(
    folder,
    () => assert.fail('unexpected launch error'),
    (command, args, options) => {
      launch = { command, args, options };
      return process;
    }
  );

  assert.equal(launch.command, 'code');
  assert.deepEqual(launch.args, [folder]);
  assert.equal(launch.options.shell, false);
  assert.equal(launch.options.windowsHide, true);
});

test('VS Code launch failure reaches the caller once', () => {
  const process = new EventEmitter();
  const errors = [];
  openInCode(
    'C:\\project',
    (error) => errors.push(error.message),
    () => process
  );
  process.emit('error', new Error('code not installed'));
  process.emit('close', -1);
  assert.deepEqual(errors, ['code not installed']);
});
