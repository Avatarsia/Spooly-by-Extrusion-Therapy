const test = require('node:test');
const assert = require('node:assert/strict');
const { attentionFor, fleetLayout, isNewAttention, groupPrinters } = require('../src/bubble-policy');

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

test('groupPrinters returns empty groups for an empty array', () => {
  assert.deepEqual(groupPrinters([]), { attention: [], rest: [] });
});

test('groupPrinters puts every attention printer in the attention group in original order', () => {
  const printers = [
    { id: 'a', status: 'error' },
    { id: 'b', status: 'paused' },
    { id: 'c', status: 'filament_out' },
  ];
  const result = groupPrinters(printers);
  assert.deepEqual(result.attention.map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(result.rest, []);
});

test('groupPrinters separates attention from rest and sorts rest by progress descending', () => {
  const printers = [
    { id: 'a', status: 'idle' },
    { id: 'b', status: 'printing', progress: 20 },
    { id: 'c', status: 'error' },
    { id: 'd', status: 'printing', progress: 80 },
    { id: 'e', status: 'offline' },
  ];
  const result = groupPrinters(printers);
  assert.deepEqual(result.attention.map((p) => p.id), ['c']);
  assert.deepEqual(result.rest.map((p) => p.id), ['d', 'b', 'a', 'e']);
});

test('groupPrinters keeps original relative order for printers with equal progress', () => {
  const printers = [
    { id: 'a', status: 'printing', progress: 50 },
    { id: 'b', status: 'printing', progress: 50 },
    { id: 'c', status: 'printing', progress: 50 },
  ];
  const result = groupPrinters(printers);
  assert.deepEqual(result.rest.map((p) => p.id), ['a', 'b', 'c']);
});

test('groupPrinters treats printing without numeric progress as everything else', () => {
  const printers = [
    { id: 'a', status: 'printing', progress: 40 },
    { id: 'b', status: 'printing' },
    { id: 'c', status: 'printing', progress: '' },
    { id: 'd', status: 'complete' },
  ];
  const result = groupPrinters(printers);
  assert.deepEqual(result.rest.map((p) => p.id), ['a', 'b', 'c', 'd']);
});

test('groupPrinters does not mutate the input array or its elements', () => {
  const printers = [
    { id: 'a', status: 'printing', progress: 20 },
    { id: 'b', status: 'printing', progress: 80 },
  ];
  const snapshot = printers.map((p) => ({ ...p }));
  groupPrinters(printers);
  assert.deepEqual(printers, snapshot);
});
