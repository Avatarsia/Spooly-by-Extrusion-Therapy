const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRemainingTime, printerStatusLabel } = require('../src/status-label');

test('formats printer-reported minutes without inventing an estimate', () => {
  assert.equal(formatRemainingTime(18), '18m left');
  assert.equal(formatRemainingTime(60), '1h left');
  assert.equal(formatRemainingTime(78), '1h 18m left');
  assert.equal(formatRemainingTime(null), '');
  assert.equal(formatRemainingTime(-3), '');
});

test('adds remaining time only to active print states', () => {
  assert.equal(printerStatusLabel({ status: 'printing', progress: 43, remainingMinutes: 78 }), 'PRINTING · 43% · 1h 18m left');
  assert.equal(printerStatusLabel({ status: 'paused', progress: 43, remainingMinutes: 8 }), 'PAUSED · 43% · 8m left');
  assert.equal(printerStatusLabel({ status: 'printing', progress: 43 }), 'PRINTING · 43%');
  assert.equal(printerStatusLabel({ status: 'idle', remainingMinutes: 78 }), 'IDLE');
  assert.equal(printerStatusLabel({ status: 'complete', progress: 100, remainingMinutes: 1 }), 'COMPLETE');
});
