const test = require('node:test');
const assert = require('node:assert/strict');
const { RepetierServerAdapter } = require('../src/adapters/repetierserver');

test('maps a running Repetier-Server job to progress and temperatures', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 42.6 },
    {
      activeExtruder: 0,
      extruder: [{ tempRead: 214.6, tempSet: 215, output: 128, error: 0 }],
      heatedBeds: [{ tempRead: 59.8, tempSet: 60, output: 80, error: 0 }],
      fans: [{ on: true, voltage: 255 }],
    },
  );
  assert.equal(state.status, 'printing');
  assert.equal(state.filename, 'cube.gcode');
  assert.equal(state.progress, 42.6);
  assert.equal(state.nozzleTemp, 214.6);
  assert.equal(state.nozzleTarget, 215);
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'fan0', label: 'FAN 0', on: true }]);
});

test('maps an idle Repetier-Server printer without fabricating progress', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'none', job: '', done: null },
    {
      activeExtruder: 0,
      extruder: [{ tempRead: 24.1, tempSet: 0, output: 0, error: 0 }],
      heatedBeds: [{ tempRead: 23.4, tempSet: 0, output: 0, error: 0 }],
      fans: [],
    },
  );
  assert.equal(state.status, 'idle');
  assert.equal(state.filename, '');
  assert.equal(state.progress, null);
  assert.equal(state.nozzleTemp, 24.1);
  assert.equal(state.nozzleTarget, 0);
  assert.equal(state.bedTemp, 23.4);
  assert.equal(state.bedTarget, 0);
  assert.deepEqual(state.fans, []);
});

test('maps a paused Repetier-Server job', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: true, jobstate: 'running', job: 'vase.gcode', done: 10 },
    { extruder: [], heatedBeds: [], fans: [] },
  );
  assert.equal(state.status, 'paused');
});

test('reports offline when the Repetier-Server printer is not online', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 0, paused: false, jobstate: 'none', job: '', done: null },
    null,
  );
  assert.equal(state.status, 'offline');
});

test('reports error when a Repetier-Server heater error code is set', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 5 },
    {
      extruder: [{ tempRead: 10, tempSet: 215, output: 0, error: 2 }],
      heatedBeds: [{ tempRead: 20, tempSet: 60, output: 0, error: 0 }],
      fans: [],
    },
  );
  assert.equal(state.status, 'error');
  assert.equal(state.message, 'Heater error reported');
});

test('read() fetches the Repetier-Server printer list and state endpoints and normalizes them', async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    if (url.includes('/printer/list')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { slug: 'ender3', name: 'Ender 3', online: 1, paused: false, jobstate: 'running', job: 'vase.gcode', jobid: 4, done: 50 },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        ender3: {
          activeExtruder: 0,
          extruder: [{ tempRead: 210, tempSet: 210, output: 128, error: 0 }],
          heatedBeds: [{ tempRead: 60, tempSet: 60, output: 80, error: 0 }],
          fans: [{ on: true, voltage: 255 }],
        },
      }),
    };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', host: '192.168.5.30', slug: 'ender3', apiKey: 'abc123' });
    const state = await adapter.read();
    assert.equal(requestedUrls[0], 'http://192.168.5.30:3344/printer/list?apikey=abc123');
    assert.equal(requestedUrls[1], 'http://192.168.5.30:3344/printer/api/ender3?a=stateList&apikey=abc123');
    assert.equal(state.status, 'printing');
    assert.equal(state.filename, 'vase.gcode');
    assert.equal(state.progress, 50);
    assert.equal(state.nozzleTemp, 210);
    assert.equal(state.bedTemp, 60);
    assert.deepEqual(state.fans, [{ key: 'fan0', label: 'FAN 0', on: true }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('read() throws when the Repetier-Server HTTP endpoint responds with an error status', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('/printer/list')) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({}) };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', host: '192.168.5.30', slug: 'ender3' });
    await assert.rejects(() => adapter.read(), /RepetierServer returned 503/);
  } finally {
    global.fetch = originalFetch;
  }
});
