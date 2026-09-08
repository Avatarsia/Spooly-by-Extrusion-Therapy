const mqtt = require('mqtt');
const { classifyConnectionError, status } = require('../bambu-connection-status');

class BambuAdapter {
  constructor(config, options = {}) {
    this.config = config;
    this.connectClient = options.connectClient || mqtt.connect;
    this.telemetryTimeoutMs = Number(options.telemetryTimeoutMs) || 12000;
    this.latest = null;
    this.latestPrint = {};
    this.client = null;
    this.hasObservedActiveJob = false;
    this.completionDismissed = false;
    this.completionTimer = null;
    this.completionHoldMs = Number(config.completionHoldMs) || 7500;
    this.telemetryTimer = null;
    this.hasAuthenticated = false;
    this.hasReceivedTelemetry = false;
    this.lastConnectionCode = null;
    this.isDisconnecting = false;
  }

  connectionStatus(callback, value) {
    if (value.code && value.code === this.lastConnectionCode) return;
    this.lastConnectionCode = value.code || null;
    callback({
      id: this.config.id,
      name: this.config.name,
      type: 'bambu',
      ...value,
    });
  }

  startTelemetryTimeout(onConnectionStatus) {
    clearTimeout(this.telemetryTimer);
    this.telemetryTimer = setTimeout(() => {
      if (!this.hasReceivedTelemetry && !this.lastConnectionCode) {
        this.connectionStatus(onConnectionStatus, status('noTelemetry'));
      }
    }, this.telemetryTimeoutMs);
  }

  connect(onUpdate, onConnected = () => {}, onConnectionStatus = () => {}) {
    if (this.client) return;
    this.isDisconnecting = false;
    this.connectionStatus(onConnectionStatus, status('connecting'));
    try {
      this.client = this.connectClient(`mqtts://${this.config.host}:8883`, {
        username: 'bblp',
        password: this.config.accessCode,
        rejectUnauthorized: false,
        connectTimeout: 4000,
        reconnectPeriod: 5000,
      });
    } catch (error) {
      this.connectionStatus(onConnectionStatus, classifyConnectionError(error));
      return;
    }
    this.client.on('connect', () => {
      this.hasAuthenticated = true;
      this.connectionStatus(onConnectionStatus, status('authenticated'));
      this.client.subscribe(`device/${this.config.serial}/report`, (error, granted = []) => {
        if (error || granted.some((entry) => Number(entry?.qos) === 128)) {
          this.connectionStatus(onConnectionStatus, status('subscription'));
          return;
        }
        this.startTelemetryTimeout(onConnectionStatus);
        this.client.publish(`device/${this.config.serial}/request`, JSON.stringify({
          pushing: { sequence_id: '0', command: 'pushall' },
        }));
      });
    });
    this.client.on('message', (_topic, payload) => {
      try {
        this.processReport(JSON.parse(payload.toString()), onUpdate);
      } catch (_) {
        this.connectionStatus(onConnectionStatus, status('malformedTelemetry'));
        return;
      }
      if (!this.hasReceivedTelemetry) {
        this.hasReceivedTelemetry = true;
        this.hasConnected = true;
        clearTimeout(this.telemetryTimer);
        this.telemetryTimer = null;
        this.connectionStatus(onConnectionStatus, status('connected'));
        onConnected(this.config);
      }
    });
    this.client.on('error', (error) => {
      if (!this.isDisconnecting && !this.hasReceivedTelemetry) {
        this.connectionStatus(onConnectionStatus, classifyConnectionError(error));
      }
    });
    this.client.on('close', () => {
      if (!this.isDisconnecting && !this.hasReceivedTelemetry && !this.lastConnectionCode) {
        this.connectionStatus(onConnectionStatus, status(this.hasAuthenticated ? 'disconnected' : 'network'));
      }
    });
  }

  processReport(report, onUpdate = () => {}) {
    const incoming = report.print || report;
    const previousStage = String(this.latestPrint.gcode_state || 'IDLE').toUpperCase();
    const previousDevice = this.latestPrint.device || {};
    const incomingDevice = incoming.device;
    const device = incomingDevice ? {
      ...previousDevice,
      ...incomingDevice,
      ...(incomingDevice.extruder ? {
        extruder: { ...previousDevice.extruder, ...incomingDevice.extruder },
      } : {}),
    } : previousDevice;
    this.latestPrint = {
      ...this.latestPrint,
      ...incoming,
      ...(incomingDevice || this.latestPrint.device ? { device } : {}),
    };
    const stage = String(this.latestPrint.gcode_state || 'IDLE').toUpperCase();

    if (stage === 'RUNNING' || stage === 'PAUSE') {
      this.hasObservedActiveJob = true;
      this.completionDismissed = false;
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    } else if (stage !== 'FINISH') {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
      if (stage === 'IDLE' || stage === 'FAILED') this.hasObservedActiveJob = false;
      this.completionDismissed = false;
    }

    const finishIsComplete = stage === 'FINISH' && this.hasObservedActiveJob && !this.completionDismissed;
    if (finishIsComplete && !this.completionTimer) {
      this.completionTimer = setTimeout(() => {
        this.completionTimer = null;
        this.completionDismissed = true;
        this.hasObservedActiveJob = false;
        this.latest = this.toPrinterState({ print: this.latestPrint }, { finishIsComplete: false });
        onUpdate(this.latest);
      }, this.completionHoldMs);
    }

    const stoppedEvent = stage === 'FAILED' && ['RUNNING', 'PAUSE'].includes(previousStage);
    this.latest = this.toPrinterState({ print: this.latestPrint }, { finishIsComplete, stoppedEvent });
    onUpdate(this.latest);
    return this.latest;
  }

  toPrinterState(report, { finishIsComplete = true, stoppedEvent = false } = {}) {
    const print = report.print || report;
    const stage = String(print.gcode_state || 'IDLE').toUpperCase();
    const rawError = print.print_error;
    const parsedError = typeof rawError === 'string' && /^0x/i.test(rawError)
      ? Number.parseInt(rawError, 16)
      : Number(rawError);
    const hasPrintError = rawError !== undefined
      && rawError !== null
      && String(rawError).trim() !== ''
      && (!Number.isFinite(parsedError) || parsedError !== 0);
    let status = 'idle';
    if (stage === 'RUNNING') status = 'printing';
    else if (stage === 'PAUSE') status = 'paused';
    else if (stage === 'FINISH') status = finishIsComplete ? 'complete' : 'idle';
    // Bambu also uses FAILED when the user deliberately stops a print. Only
    // pair it with an actual error code before presenting it as an alert.
    if (hasPrintError) status = 'error';
    const numeric = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;
    const packedTemperature = (value) => {
      const packed = numeric(value);
      if (packed === null) return null;
      return {
        current: packed & 0xFFFF,
        target: Math.floor(packed / 0x10000) & 0xFFFF,
      };
    };
    const extruder = print.device?.extruder;
    const extruderState = numeric(extruder?.state);
    const activeNozzleIndex = extruderState === null ? null : (extruderState >> 4) & 0xF;
    const nozzleEntries = Array.isArray(extruder?.info) ? extruder.info : [];
    const activeNozzleEntry = nozzleEntries.find((entry) => numeric(entry?.id) === activeNozzleIndex)
      || (nozzleEntries.length === 1 ? nozzleEntries[0] : null);
    const activeNozzle = packedTemperature(activeNozzleEntry?.temp);
    const packedBed = packedTemperature(print.device?.bed?.info?.temp ?? print.device?.bed_temp);
    const fan = (key, label) => {
      const speed = numeric(print[key]);
      return speed === null ? null : { key, label, on: speed > 0 };
    };
    const suppliedMessage = print.error_msg || print.message || print.msg || '';
    return {
      id: this.config.id,
      name: this.config.name,
      type: 'bambu',
      status,
      message: hasPrintError ? String(suppliedMessage || `Printer error ${rawError}`) : '',
      attention: stoppedEvent && !hasPrintError ? { type: 'stopped', message: 'Print stopped' } : null,
      filename: print.subtask_name || print.gcode_file || '',
      progress: numeric(print.mc_percent),
      remainingMinutes: numeric(print.mc_remaining_time),
      nozzleTemp: activeNozzle?.current ?? numeric(print.nozzle_temper),
      nozzleTarget: activeNozzle?.target ?? numeric(print.nozzle_target_temper),
      bedTemp: packedBed?.current ?? numeric(print.bed_temper),
      bedTarget: packedBed?.target ?? numeric(print.bed_target_temper),
      fans: [
        fan('cooling_fan_speed', 'PART'),
        fan('big_fan1_speed', 'AUX'),
        fan('big_fan2_speed', 'CHAMBER'),
      ].filter(Boolean),
    };
  }

  disconnect() {
    this.isDisconnecting = true;
    clearTimeout(this.completionTimer);
    clearTimeout(this.telemetryTimer);
    this.completionTimer = null;
    this.telemetryTimer = null;
    this.client?.end(true);
    this.client = null;
    this.hasConnected = false;
    this.hasAuthenticated = false;
    this.hasReceivedTelemetry = false;
    this.lastConnectionCode = null;
    this.latestPrint = {};
    this.hasObservedActiveJob = false;
    this.completionDismissed = false;
  }
}

module.exports = { BambuAdapter };
