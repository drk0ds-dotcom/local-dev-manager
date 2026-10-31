let output = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  output += chunk;
  process.stdout.write(chunk);
});

process.stdin.on('end', () => {
  const tests = output.match(/^# tests (\d+)$/m);
  const passed = output.match(/^# pass (\d+)$/m);
  const failed = output.match(/^# fail (\d+)$/m);
  const cancelled = output.match(/^# cancelled (\d+)$/m);
  const skipped = output.match(/^# skipped (\d+)$/m);
  if (!tests || !passed || !failed || !cancelled || !skipped) {
    process.stderr.write('CI test run did not produce a complete test summary\n');
    process.exitCode = 1;
    return;
  }
  if (Number(failed[1]) > 0) {
    process.stderr.write(`${failed[1]} failed test(s) in CI\n`);
    process.exitCode = 1;
  }
  if (Number(cancelled[1]) > 0) {
    process.stderr.write(`${cancelled[1]} cancelled test(s) in CI\n`);
    process.exitCode = 1;
  }
  if (Number(skipped[1]) > 0) {
    process.stderr.write(`${skipped[1]} skipped test(s) in CI\n`);
    process.exitCode = 1;
  }
});
