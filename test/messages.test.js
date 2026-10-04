const test = require('node:test');
const assert = require('node:assert/strict');
const { APP_MESSAGES, PROCESS_MESSAGES, formatAppMessage, formatProcessMessage } = require('../messages');

test('application and process messages have matching Arabic and English keys', () => {
  assert.deepEqual(Object.keys(APP_MESSAGES.ar).sort(), Object.keys(APP_MESSAGES.en).sort());
  assert.deepEqual(Object.keys(PROCESS_MESSAGES.ar).sort(), Object.keys(PROCESS_MESSAGES.en).sort());
});

test('Arabic application errors use Arabic prose while preserving technical identifiers', () => {
  assert.equal(
    formatAppMessage('ar', 'addedProject', 'demo', 'dev', 3000),
    '✅ أُضيف المشروع "demo" (الأمر: dev، المنفذ: 3000)'
  );
  assert.equal(
    formatAppMessage('ar', 'packageManagerUnavailable', 'pnpm'),
    '❌ مدير الحزم pnpm غير متاح — ثبّته ثم أعد المحاولة'
  );
  assert.equal(
    formatAppMessage('en', 'packageManagerUnavailable', 'pnpm'),
    '❌ pnpm is unavailable — install it and try again'
  );
});

test('Arabic process failures use Arabic terms for installation and exit codes', () => {
  assert.equal(
    formatProcessMessage('ar', 'installing', 'npm'),
    '📦 مجلد node_modules غير موجود — يُثبّت البرنامج الاعتمادات تلقائيًا باستخدام npm...'
  );
  assert.equal(
    formatProcessMessage('ar', 'installFailed', 'npm', 1),
    '❌ فشل تثبيت الاعتمادات باستخدام npm (رمز الخروج: 1)'
  );
  assert.equal(formatProcessMessage('ar', 'stoppedUnexpectedly', 7), '🔴 توقف المشروع (رمز الخروج: 7)');
});
