const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WEEK_MS,
  automaticCheckDue,
  shouldNotifyForUpdate,
  shouldRunAutomaticUpdate,
} = require('../src/update-schedule');

test('automatic update check is due initially and after one week', () => {
  const now = 2_000_000_000_000;
  assert.equal(automaticCheckDue(0, now), true);
  assert.equal(automaticCheckDue(now - WEEK_MS + 1, now), false);
  assert.equal(automaticCheckDue(now - WEEK_MS, now), true);
});

test('future or malformed timestamps self-heal on the next scheduled check', () => {
  const now = 2_000_000_000_000;
  assert.equal(automaticCheckDue(now + WEEK_MS, now), true);
  assert.equal(automaticCheckDue('not-a-date', now), true);
});

test('disabled automatic updates never make a scheduled request', () => {
  assert.equal(shouldRunAutomaticUpdate(false, 0), false);
  assert.equal(shouldRunAutomaticUpdate(true, 0), true);
});

test('automatic update notifications are deduplicated and honor opt-out', () => {
  const update = { updateAvailable: true, latest: '0.1.15' };
  assert.equal(shouldNotifyForUpdate(true, update, ''), true);
  assert.equal(shouldNotifyForUpdate(true, update, '0.1.15'), false);
  assert.equal(shouldNotifyForUpdate(false, update, ''), false);
  assert.equal(shouldNotifyForUpdate(true, { updateAvailable: false, latest: '0.1.15' }, ''), false);
  assert.equal(shouldNotifyForUpdate(true, { updateAvailable: true, latest: '' }, ''), false);
});
