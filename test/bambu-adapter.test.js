const test = require('node:test');
const assert = require('node:assert/strict');
const { BambuAdapter } = require('../src/adapters/bambu');

function adapter() {
  return new BambuAdapter({ id: 'bambu-1', name: 'Test Bambu' });
}

test('treats a manually stopped Bambu print as idle', () => {
  const state = adapter().toPrinterState({ print: { gcode_state: 'FAILED', print_error: 0 } });
  assert.equal(state.status, 'idle');
  assert.equal(state.message, '');
});

test('does not mistake a string zero error code for an error', () => {
  const state = adapter().toPrinterState({ print: { gcode_state: 'IDLE', print_error: '0' } });
  assert.equal(state.status, 'idle');
});

test('keeps a genuine Bambu printer error red', () => {
  const state = adapter().toPrinterState({ print: { gcode_state: 'FAILED', print_error: 1234 } });
  assert.equal(state.status, 'error');
  assert.equal(state.message, 'Printer error 1234');
});

test('merges partial Bambu updates so an error remains visible until cleared', () => {
  const states = [];
  const device = adapter();
  device.processReport({ print: { gcode_state: 'RUNNING', mc_percent: 42 } }, (state) => states.push(state));
  device.processReport({ print: { print_error: 1234 } }, (state) => states.push(state));
  device.processReport({ print: { mc_percent: 43 } }, (state) => states.push(state));
  assert.equal(states.at(-1).status, 'error');
  assert.equal(states.at(-1).progress, 43);
  device.processReport({ print: { print_error: 0 } }, (state) => states.push(state));
  assert.equal(states.at(-1).status, 'printing');
});

test('shows a live completion once and then turns stale FINISH into idle', async () => {
  const states = [];
  const device = new BambuAdapter({ id: 'bambu-1', name: 'Test Bambu', completionHoldMs: 10 });
  device.processReport({ print: { gcode_state: 'RUNNING' } }, (state) => states.push(state.status));
  device.processReport({ print: { gcode_state: 'FINISH', mc_percent: 100 } }, (state) => states.push(state.status));
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(states, ['printing', 'complete', 'idle']);
  device.disconnect();
});

test('does not replay an old Bambu completion after Spooly starts', () => {
  const device = adapter();
  const state = device.processReport({ print: { gcode_state: 'FINISH', mc_percent: 100 } });
  assert.equal(state.status, 'idle');
});

test('reports available Bambu fans and a one-shot stopped event', () => {
  const device = adapter();
  device.processReport({ print: { gcode_state: 'RUNNING', cooling_fan_speed: '8', big_fan1_speed: '0' } });
  const stopped = device.processReport({ print: { gcode_state: 'FAILED', print_error: 0 } });
  assert.deepEqual(stopped.fans, [
    { key: 'cooling_fan_speed', label: 'PART', on: true },
    { key: 'big_fan1_speed', label: 'AUX', on: false },
  ]);
  assert.deepEqual(stopped.attention, { type: 'stopped', message: 'Print stopped' });
  const repeat = device.processReport({ print: { mc_percent: 43 } });
  assert.equal(repeat.attention, null);
});

test('decodes the active nozzle from an H2D dual-nozzle payload', () => {
  const state = adapter().toPrinterState({ print: {
    gcode_state: 'RUNNING',
    device: {
      extruder: {
        state: 0x12,
        info: [
          { id: 0, temp: (220 << 16) | 72 },
          { id: 1, temp: (255 << 16) | 254 },
        ],
      },
      bed: { info: { temp: (80 << 16) | 79 } },
    },
  } });
  assert.equal(state.nozzleTemp, 254);
  assert.equal(state.nozzleTarget, 255);
  assert.equal(state.bedTemp, 79);
  assert.equal(state.bedTarget, 80);
});

test('retains H2-series active-nozzle data across partial MQTT updates', () => {
  const device = adapter();
  device.processReport({ print: {
    gcode_state: 'RUNNING',
    device: {
      extruder: {
        state: 0x12,
        info: [
          { id: 0, temp: (220 << 16) | 70 },
          { id: 1, temp: (250 << 16) | 249 },
        ],
      },
    },
  } });
  const state = device.processReport({ print: { mc_percent: 50 } });
  assert.equal(state.nozzleTemp, 249);
  assert.equal(state.nozzleTarget, 250);
});

test('supports H2C nozzle identifiers beyond the legacy dual-nozzle pair', () => {
  const state = adapter().toPrinterState({ print: {
    gcode_state: 'RUNNING',
    device: {
      extruder: {
        state: 0xF2,
        info: [
          { id: 0, temp: (220 << 16) | 80 },
          { id: 15, temp: (235 << 16) | 234 },
        ],
      },
    },
  } });
  assert.equal(state.nozzleTemp, 234);
  assert.equal(state.nozzleTarget, 235);
});

test('does not fabricate zeroes from missing Bambu telemetry', () => {
  const state = adapter().toPrinterState({ print: {
    gcode_state: 'IDLE',
    mc_percent: null,
    nozzle_temper: null,
    bed_temper: null,
    cooling_fan_speed: null,
  } });
  assert.equal(state.progress, null);
  assert.equal(state.remainingMinutes, null);
  assert.equal(state.nozzleTemp, null);
  assert.equal(state.bedTemp, null);
  assert.deepEqual(state.fans, []);
});

test('maps printer-reported Bambu remaining time without estimating it', () => {
  const state = adapter().toPrinterState({ print: {
    gcode_state: 'RUNNING',
    mc_percent: 42,
    mc_remaining_time: 78,
  } });
  assert.equal(state.remainingMinutes, 78);
});
