const test = require('node:test');
const assert = require('node:assert/strict');
const { MoonrakerAdapter } = require('../src/adapters/moonraker');

test('maps Moonraker print progress and temperatures', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'printing', filename: 'cube.gcode' }, null, {
    virtualSdcard: { progress: 0.426 },
    extruder: { temperature: 214.6, target: 215 },
    heaterBed: { temperature: 59.8, target: 60 },
    fans: [{ key: 'part', label: 'PART', on: true }],
  });
  assert.equal(state.status, 'printing');
  assert.equal(state.progress, 42.6);
  assert.equal(state.nozzleTemp, 214.6);
  assert.equal(state.nozzleTarget, 215);
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'part', label: 'PART', on: true }]);
});

test('maps a cancelled Moonraker job to an idle one-shot notification', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'cancelled' });
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.attention, { type: 'stopped', message: 'Print stopped' });
});

test('uses the Moonraker toolhead active extruder on a multi-tool printer', () => {
  const adapter = new MoonrakerAdapter({ id: 'u1', name: 'Snapmaker U1' });
  const active = adapter.selectActiveExtruder({
    toolhead: { extruder: 'extruder1' },
    extruder: { temperature: 24, target: 0 },
    extruder1: { temperature: 255, target: 255 },
    extruder2: { temperature: 24, target: 0 },
    extruder3: { temperature: 24, target: 0 },
  }, ['extruder', 'extruder1', 'extruder2', 'extruder3']);
  assert.deepEqual(active, { temperature: 255, target: 255 });
});

test('does not fabricate zeroes from missing Moonraker telemetry', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'standby' }, null, {
    virtualSdcard: { progress: null },
    extruder: { temperature: null, target: null },
    heaterBed: { temperature: null, target: null },
  });
  assert.equal(state.progress, null);
  assert.equal(state.nozzleTemp, null);
  assert.equal(state.nozzleTarget, null);
  assert.equal(state.bedTemp, null);
  assert.equal(state.bedTarget, null);
});

test('defaults a plain host to http with the Moonraker port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: '192.168.1.42' });
  assert.equal(adapter.baseUrl, 'http://192.168.1.42:7125');
});

test('keeps an explicit https scheme without forcing the default port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'https://voron.local' });
  assert.equal(adapter.baseUrl, 'https://voron.local');
});

test('keeps an explicit https scheme and honors a configured port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'https://voron.local', port: 8443 });
  assert.equal(adapter.baseUrl, 'https://voron.local:8443');
});

test('strips an explicit http scheme and still applies the default port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'http://192.168.1.42' });
  assert.equal(adapter.baseUrl, 'http://192.168.1.42:7125');
});

test('strips a trailing slash from the host before building the URL', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'https://voron.example.com/' });
  assert.equal(adapter.baseUrl, 'https://voron.example.com');
});

test('defaults a bare domain with no scheme to https instead of the LAN port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'voron.example.com' });
  assert.equal(adapter.baseUrl, 'https://voron.example.com');
});

test('honors a configured port on a bare domain default to https', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'voron.example.com', port: 8443 });
  assert.equal(adapter.baseUrl, 'https://voron.example.com:8443');
});

test('still defaults localhost to http with the Moonraker port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'localhost' });
  assert.equal(adapter.baseUrl, 'http://localhost:7125');
});

test('an explicit http scheme forces http even on a domain', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'http://voron.example.com' });
  assert.equal(adapter.baseUrl, 'http://voron.example.com:7125');
});
