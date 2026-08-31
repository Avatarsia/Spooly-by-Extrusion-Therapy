const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalPrinterKey, dedupePrinters } = require('../src/printers');

test('identifies duplicate Bambu printers by serial regardless of IP', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'bambu', host: '192.168.1.2', serial: 'abc123' }),
    canonicalPrinterKey({ type: 'bambu', host: '192.168.1.9', serial: 'ABC123' }),
  );
});

test('identifies duplicate Moonraker printers by normalized host and port', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'moonraker', host: 'http://Voron.local/', port: 7125 }),
    canonicalPrinterKey({ type: 'moonraker', host: 'voron.local', port: 7125 }),
  );
});

test('deduplicates printer configurations while preserving the first', () => {
  const first = { id: 'one', type: 'moonraker', host: '192.168.1.8', port: 7125 };
  const duplicate = { id: 'two', type: 'moonraker', host: '192.168.1.8', port: 7125 };
  assert.deepEqual(dedupePrinters([first, duplicate]), [first]);
});
