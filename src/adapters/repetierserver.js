// Repetier-Server: job/progress data and heater/fan telemetry live behind two different
// dyn-requests of Repetier-Server's REST API (both documented as "websocket commands callable
// as REST" at https://www.repetier-server.com/manuals/programming/API/index.html):
//   - GET /printer/list                         -> { data: [ { slug, online, paused, jobstate,
//                                                     job, done, ... } ] } for ALL configured
//                                                     printers (job name, progress %, pause/
//                                                     online flags; confirmed field names via
//                                                     the actively maintained RepetierServerSharpApi
//                                                     client's JsonProperty-annotated models).
//   - GET /printer/api/<slug>?a=stateList        -> { <slug>: { extruder: [{tempRead,tempSet,
//                                                     error}], heatedBeds: [{tempRead,tempSet,
//                                                     error}], fans: [{on,voltage}], ... } } for
//                                                     one printer's live heater/fan telemetry.
// `apikey` is optional per the docs (a machine password/session also works), passed as a query
// param since this is a local desktop client, not a shared proxy.
// jobstate only distinguishes "running" from not-running (RepetierServerSharpApi's
// RepetierCurrentPrintInfo maps jobstate === 'running' to in-progress, anything else to
// completed) - there is no documented terminal "finished" job state and no filament-runout
// sensor field anywhere in this API, so Spooly's 'complete' and 'filament_out' statuses are
// intentionally never produced here (same discipline as the Duet adapter).
class RepetierServerAdapter {
  constructor(config) {
    this.config = config;
  }

  get baseUrl() {
    const host = this.config.host.replace(/^https?:\/\//, '');
    return `http://${host}:${this.config.port || 3344}`;
  }

  async read() {
    const slug = this.config.slug;
    const apiKeyParam = this.config.apiKey ? `apikey=${encodeURIComponent(this.config.apiKey)}` : '';
    const listUrl = `${this.baseUrl}/printer/list${apiKeyParam ? `?${apiKeyParam}` : ''}`;
    const stateUrl = `${this.baseUrl}/printer/api/${encodeURIComponent(slug)}?a=stateList${apiKeyParam ? `&${apiKeyParam}` : ''}`;

    const [listResponse, stateResponse] = await Promise.all([
      fetch(listUrl, { signal: AbortSignal.timeout(3500) }),
      fetch(stateUrl, { signal: AbortSignal.timeout(3500) }),
    ]);
    if (!listResponse.ok) throw new Error(`RepetierServer returned ${listResponse.status}`);
    if (!stateResponse.ok) throw new Error(`RepetierServer returned ${stateResponse.status}`);

    const listBody = await listResponse.json();
    const stateBody = await stateResponse.json();
    const printers = Array.isArray(listBody?.data) ? listBody.data : [];
    const printerEntry = printers.find((printer) => printer?.slug === slug) || null;
    const stateEntry = stateBody?.[slug] || null;

    return this.toPrinterState(printerEntry, stateEntry);
  }

  toPrinterState(printerEntry = null, stateEntry = null) {
    const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;

    const online = Boolean(printerEntry?.online);
    const paused = Boolean(printerEntry?.paused);
    const running = printerEntry?.jobstate === 'running';

    const extruders = Array.isArray(stateEntry?.extruder) ? stateEntry.extruder : [];
    const activeExtruderIndex = Number.isInteger(stateEntry?.activeExtruder) && stateEntry.activeExtruder >= 0
      ? stateEntry.activeExtruder
      : 0;
    const nozzleHeater = extruders[activeExtruderIndex] || extruders[0] || null;
    const bedHeaters = Array.isArray(stateEntry?.heatedBeds) ? stateEntry.heatedBeds : [];
    const bedHeater = bedHeaters[0] || null;

    const heaterHasError = (heater) => numeric(heater?.error) > 0;
    const hasHeaterError = heaterHasError(nozzleHeater) || heaterHasError(bedHeater);

    let status = 'idle';
    if (!online) status = 'offline';
    else if (hasHeaterError) status = 'error';
    else if (paused) status = 'paused';
    else if (running) status = 'printing';

    const rawProgress = numeric(printerEntry?.done);
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress));

    const fans = Array.isArray(stateEntry?.fans)
      ? stateEntry.fans.map((fan, index) => ({
        key: `fan${index}`,
        label: `FAN ${index}`,
        on: Boolean(fan?.on),
      }))
      : [];

    return {
      id: this.config.id,
      name: this.config.name,
      type: 'repetierserver',
      status,
      message: hasHeaterError ? 'Heater error reported' : '',
      attention: null,
      filename: printerEntry?.job || '',
      progress,
      nozzleTemp: numeric(nozzleHeater?.tempRead),
      nozzleTarget: numeric(nozzleHeater?.tempSet),
      bedTemp: numeric(bedHeater?.tempRead),
      bedTarget: numeric(bedHeater?.tempSet),
      fans,
    };
  }
}

module.exports = { RepetierServerAdapter };
