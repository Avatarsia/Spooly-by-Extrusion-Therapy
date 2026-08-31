const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregatePrinters } = require('../src/state');

test('sleeps when all printers are offline', () => assert.equal(aggregatePrinters([{ status: 'offline' }]).status, 'offline'));
test('ignores an offline printer when another is printing', () => assert.equal(aggregatePrinters([{ status: 'offline' }, { status: 'printing' }]).status, 'printing'));
test('selects the most severe live state', () => assert.equal(aggregatePrinters([{ status: 'printing' }, { status: 'paused' }, { status: 'error' }]).status, 'error'));
test('a completed printer outranks another printer that is still printing', () => {
  const completedFirst = aggregatePrinters([
    { name: 'Completed printer', status: 'complete' },
    { name: 'Active printer', status: 'printing' },
  ]);
  const printingFirst = aggregatePrinters([
    { name: 'Active printer', status: 'printing' },
    { name: 'Completed printer', status: 'complete' },
  ]);

  assert.equal(completedFirst.status, 'complete');
  assert.equal(completedFirst.source.name, 'Completed printer');
  assert.equal(printingFirst.status, 'complete');
  assert.equal(printingFirst.source.name, 'Completed printer');
});
test('attention states continue to outrank completion', () => {
  assert.equal(aggregatePrinters([{ status: 'complete' }, { status: 'paused' }]).status, 'paused');
  assert.equal(aggregatePrinters([{ status: 'complete' }, { status: 'filament_out' }]).status, 'filament_out');
  assert.equal(aggregatePrinters([{ status: 'complete' }, { status: 'error' }]).status, 'error');
});
test('keeps a shared status stable', () => assert.equal(aggregatePrinters([{ status: 'printing' }, { status: 'printing' }]).status, 'printing'));
