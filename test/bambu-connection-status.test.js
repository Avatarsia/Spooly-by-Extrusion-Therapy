const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { BambuAdapter } = require('../src/adapters/bambu');
const {
  classifyConnectionError,
  nextPendingSetupPrinters,
  shouldReportSetupConnection,
  storeConnectionStatus,
} = require('../src/bambu-connection-status');

class FakeMqttClient extends EventEmitter {
  constructor({ subscribeError = null, granted = [{ qos: 0 }] } = {}) {
    super();
    this.subscribeError = subscribeError;
    this.granted = granted;
    this.ended = false;
  }

  subscribe(topic, callback) {
    this.subscription = topic;
    callback(this.subscribeError, this.granted);
  }

  publish(topic, payload) {
    this.published = { topic, payload };
  }

  end() {
    this.ended = true;
  }
}

function connectedHarness(clientOptions = {}, adapterOptions = {}) {
  const client = new FakeMqttClient(clientOptions);
  const statuses = [];
  const connected = [];
  const states = [];
  const device = new BambuAdapter({
    id: 'bambu-1',
    name: 'Test Bambu',
    host: '192.168.1.25',
    serial: 'SERIAL123',
    accessCode: 'secret',
  }, {
    connectClient: () => client,
    telemetryTimeoutMs: 10,
    ...adapterOptions,
  });
  device.connect(
    (value) => states.push(value),
    (value) => connected.push(value),
    (value) => statuses.push(value),
  );
  return { client, connected, device, states, statuses };
}

function throwingHarness(error) {
  const statuses = [];
  const device = new BambuAdapter({ id: 'bambu-1', name: 'Test Bambu', host: '192.168.1.25' }, {
    connectClient: () => { throw error; },
  });
  device.connect(() => {}, () => {}, (value) => statuses.push(value));
  return statuses;
}

test('classifies explicit authentication, TLS, network, and unknown MQTT failures', () => {
  assert.equal(classifyConnectionError({ code: 5 }).code, 'BAMBU-AUTH-01');
  assert.equal(classifyConnectionError({ reasonCode: 0x87 }).code, 'BAMBU-AUTH-01');
  assert.equal(classifyConnectionError({ code: 'ERR_SSL_WRONG_VERSION_NUMBER' }).code, 'BAMBU-TLS-01');
  assert.equal(classifyConnectionError({ code: 'ECONNREFUSED' }).code, 'BAMBU-NETWORK-01');
  assert.equal(classifyConnectionError({ message: 'unexpected failure' }).code, 'BAMBU-CONNECTION-01');
});

test('reports authentication rejection without exposing credentials', () => {
  const { client, statuses } = connectedHarness();
  client.emit('error', Object.assign(new Error('Connection refused: Not authorized'), { code: 5 }));
  assert.equal(statuses.at(-1).code, 'BAMBU-AUTH-01');
  assert.doesNotMatch(JSON.stringify(statuses), /secret|SERIAL123|192\.168\.1\.25/);
});

test('reports simulated network and TLS setup failures through the adapter', () => {
  assert.equal(throwingHarness(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })).at(-1).code, 'BAMBU-NETWORK-01');
  assert.equal(throwingHarness(Object.assign(new Error('TLS failed'), { code: 'ERR_TLS_HANDSHAKE_TIMEOUT' })).at(-1).code, 'BAMBU-TLS-01');
});

test('reports a rejected status subscription', () => {
  const { client, statuses } = connectedHarness({}, { telemetryTimeoutMs: 100 });
  client.granted = [{ qos: 128 }];
  client.emit('connect');
  assert.equal(statuses.at(-1).code, 'BAMBU-SUBSCRIBE-01');
});

test('reports a likely serial mismatch when authenticated but telemetry never arrives', async () => {
  const { client, device, statuses } = connectedHarness();
  client.emit('connect');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(statuses.at(-1).code, 'BAMBU-DATA-01');
  device.disconnect();
});

test('distinguishes a dropped authenticated connection from missing telemetry', () => {
  const { client, device, statuses } = connectedHarness({}, { telemetryTimeoutMs: 100 });
  client.emit('connect');
  client.emit('close');
  assert.equal(statuses.at(-1).code, 'BAMBU-NETWORK-02');
  device.disconnect();
});

test('intentional multi-printer shutdown never reports a connection failure', () => {
  const first = connectedHarness({}, { telemetryTimeoutMs: 100 });
  const second = connectedHarness({}, { telemetryTimeoutMs: 100 });
  first.device.disconnect();
  second.device.disconnect();
  first.client.emit('error', Object.assign(new Error('socket closed'), { code: 'ECONNRESET' }));
  first.client.emit('close');
  second.client.emit('close');
  assert.equal(first.statuses.some((value) => value.phase === 'failed'), false);
  assert.equal(second.statuses.some((value) => value.phase === 'failed'), false);
});

test('successful connection status is transient rather than stored', () => {
  const statuses = new Map();
  storeConnectionStatus(statuses, { id: 'bambu-1', phase: 'connecting' });
  assert.equal(statuses.has('bambu-1'), true);
  storeConnectionStatus(statuses, { id: 'bambu-1', phase: 'connected' });
  assert.equal(statuses.has('bambu-1'), false);
});

test('setup connection details are limited to printers added by the current save', () => {
  const newPrinterIds = new Set(['new-bambu']);
  assert.equal(shouldReportSetupConnection(newPrinterIds, 'new-bambu'), true);
  assert.equal(shouldReportSetupConnection(newPrinterIds, 'existing-bambu-1'), false);
  assert.equal(shouldReportSetupConnection(newPrinterIds, 'existing-bambu-2'), false);
});

test('a failed new printer stays in setup until it connects or is removed', () => {
  const firstSave = nextPendingSetupPrinters(
    new Set(),
    new Set(['existing']),
    new Set(['existing', 'new-bambu']),
  );
  assert.deepEqual([...firstSave], ['new-bambu']);
  const retrySave = nextPendingSetupPrinters(
    firstSave,
    new Set(['existing', 'new-bambu']),
    new Set(['existing', 'new-bambu']),
  );
  assert.deepEqual([...retrySave], ['new-bambu']);
  const removed = nextPendingSetupPrinters(
    retrySave,
    new Set(['existing', 'new-bambu']),
    new Set(['existing']),
  );
  assert.deepEqual([...removed], []);
});

test('reports malformed printer data and remains available for a later valid report', () => {
  const { client, connected, device, statuses } = connectedHarness({}, { telemetryTimeoutMs: 100 });
  client.emit('connect');
  client.emit('message', 'topic', Buffer.from('{bad json'));
  assert.equal(statuses.at(-1).code, 'BAMBU-DATA-02');
  assert.equal(connected.length, 0);
  client.emit('message', 'topic', Buffer.from(JSON.stringify({ print: { gcode_state: 'IDLE' } })));
  assert.equal(statuses.at(-1).phase, 'connected');
  assert.equal(connected.length, 1);
  device.disconnect();
});

test('does not replace a specific data error with the generic telemetry timeout', async () => {
  const { client, device, statuses } = connectedHarness();
  client.emit('connect');
  client.emit('message', 'topic', Buffer.from('{bad json'));
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(statuses.at(-1).code, 'BAMBU-DATA-02');
  device.disconnect();
});

test('declares success only after authenticated telemetry is received', () => {
  const { client, connected, device, states, statuses } = connectedHarness({}, { telemetryTimeoutMs: 100 });
  client.emit('connect');
  assert.equal(statuses.at(-1).phase, 'authenticated');
  assert.equal(connected.length, 0);
  assert.equal(client.subscription, 'device/SERIAL123/report');
  client.emit('message', 'topic', Buffer.from(JSON.stringify({ print: { gcode_state: 'IDLE' } })));
  assert.equal(statuses.at(-1).phase, 'connected');
  assert.equal(connected.length, 1);
  assert.equal(states.length, 1);
  device.disconnect();
});
