const AUTH_CODES = new Set([4, 5, 0x86, 0x87]);
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

const CONNECTION_STATUS = {
  connecting: {
    phase: 'connecting',
    message: 'Testing the printer connection…',
  },
  authenticated: {
    phase: 'authenticated',
    message: 'Access code accepted. Waiting for printer data…',
  },
  connected: {
    phase: 'connected',
    message: 'Connected successfully.',
  },
  network: {
    phase: 'failed',
    code: 'BAMBU-NETWORK-01',
    message: 'Could not reach the printer. Verify its IP address and network connection.',
  },
  disconnected: {
    phase: 'failed',
    code: 'BAMBU-NETWORK-02',
    message: 'The connection closed before printer data arrived. Verify the network and try again.',
  },
  tls: {
    phase: 'failed',
    code: 'BAMBU-TLS-01',
    message: 'The secure connection failed. Verify the printer address and firmware, then try again.',
  },
  authentication: {
    phase: 'failed',
    code: 'BAMBU-AUTH-01',
    message: 'The printer rejected the access code. Re-enter the code shown by the printer.',
  },
  subscription: {
    phase: 'failed',
    code: 'BAMBU-SUBSCRIBE-01',
    message: 'The printer rejected Spooly’s status-data subscription.',
  },
  noTelemetry: {
    phase: 'failed',
    code: 'BAMBU-DATA-01',
    message: 'Connected, but no printer data was received. Verify the serial number.',
  },
  malformedTelemetry: {
    phase: 'failed',
    code: 'BAMBU-DATA-02',
    message: 'Printer data arrived, but Spooly could not read it.',
  },
  unknown: {
    phase: 'failed',
    code: 'BAMBU-CONNECTION-01',
    message: 'Could not connect to the printer. Verify its IP address, access code, and network connection.',
  },
};

function status(kind) {
  return { ...CONNECTION_STATUS[kind] };
}

function classifyConnectionError(error = {}) {
  const numericCodes = [error.code, error.reasonCode, error.returnCode]
    .map(Number)
    .filter(Number.isFinite);
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || error.reasonString || '').toLowerCase();

  if (numericCodes.some((value) => AUTH_CODES.has(value))
    || /not authorized|bad user|bad username|bad password|authentication|access code/.test(message)) {
    return status('authentication');
  }
  if (code.startsWith('ERR_TLS') || code.startsWith('ERR_SSL')
    || /\btls\b|\bssl\b|certificate|secure connection/.test(message)) {
    return status('tls');
  }
  if (NETWORK_CODES.has(code)
    || /timed out|timeout|refused|unreachable|not found|socket hang up/.test(message)) {
    return status('network');
  }
  return status('unknown');
}

module.exports = { classifyConnectionError, status };
