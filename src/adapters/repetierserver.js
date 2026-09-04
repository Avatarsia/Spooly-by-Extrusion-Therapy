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
// The API key is sent as an `X-Api-Key` request header, not a query param: confirmed against
// OrcaSlicer's (and upstream PrusaSlicer's) actively-maintained Repetier-Server print-host
// client (src/slic3r/Utils/Repetier.cpp, Repetier::set_auth()), which does
// `http.header("X-Api-Key", apikey)` for every request against these same `printer/list` and
// `printer/api/<slug>` endpoints.
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

  get authHeaders() {
    return this.config.apiKey ? { 'X-Api-Key': this.config.apiKey } : {};
  }

  async fetchPrinterList() {
    const listUrl = `${this.baseUrl}/printer/list`;
    const listResponse = await fetch(listUrl, { headers: this.authHeaders, signal: AbortSignal.timeout(3500) });
    if (!listResponse.ok) throw new Error(`RepetierServer returned ${listResponse.status}`);
    const listBody = await listResponse.json();
    return Array.isArray(listBody?.data) ? listBody.data : [];
  }

  // Used by the settings UI's "Fetch printers" picker (see main.js's
  // repetierserver:list-printers IPC handler) so a user can pick a slug
  // instead of typing it blind.
  async listPrinters() {
    const printers = await this.fetchPrinterList();
    return printers
      .filter((printer) => printer?.slug)
      .map((printer) => ({ slug: printer.slug, name: printer.name || printer.slug }));
  }

  async read() {
    const slug = this.config.slug;
    const stateUrl = `${this.baseUrl}/printer/api/${encodeURIComponent(slug)}?a=stateList`;

    const [printers, stateResponse] = await Promise.all([
      this.fetchPrinterList(),
      fetch(stateUrl, { headers: this.authHeaders, signal: AbortSignal.timeout(3500) }),
    ]);
    if (!stateResponse.ok) throw new Error(`RepetierServer returned ${stateResponse.status}`);

    const stateBody = await stateResponse.json();
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
