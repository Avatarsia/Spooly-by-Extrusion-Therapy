const test = require('node:test');
const assert = require('node:assert/strict');
const { attentionFor, fleetLayout, isNewAttention } = require('../src/bubble-policy');

test('fleet layout fills up to four rows before adding another column', () => {
  assert.deepEqual(fleetLayout(3), { columns: 1, rows: 3 });
  assert.deepEqual(fleetLayout(4), { columns: 1, rows: 4 });
  assert.deepEqual(fleetLayout(5), { columns: 2, rows: 3 });
  assert.deepEqual(fleetLayout(6), { columns: 2, rows: 3 });
  assert.deepEqual(fleetLayout(7), { columns: 2, rows: 4 });
  assert.deepEqual(fleetLayout(8), { columns: 2, rows: 4 });
  assert.deepEqual(fleetLayout(9), { columns: 3, rows: 3 });
  assert.deepEqual(fleetLayout(12), { columns: 3, rows: 4 });
  assert.deepEqual(fleetLayout(15), { columns: 3, rows: 5 });
});

test('attention only retriggers for a new condition or changed message', () => {
  const paused = { status: 'paused', message: '' };
  assert.equal(isNewAttention({ status: 'printing' }, paused), true);
  assert.equal(isNewAttention(paused, { ...paused, progress: 48 }), false);
  assert.equal(isNewAttention({ status: 'error', message: 'Jam' }, { status: 'error', message: 'Jam' }), false);
  assert.equal(isNewAttention({ status: 'error', message: 'Jam' }, { status: 'error', message: 'Door open' }), true);
  assert.equal(attentionFor({ status: 'idle', attention: { type: 'stopped', message: 'Print stopped' } }).type, 'stopped');
});
