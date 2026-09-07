const path = require('path');

// Where a click on a printer name in the bubble should go. Pure lookup so it
// can be unit-tested without Electron; main.js hands the result to shell.*.

function stripScheme(host = '') {
  return String(host).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function moonrakerWebUrl(printer) {
  const raw = String(printer.host || '').trim();
  const host = stripScheme(raw);
  if (!host) return null;
  // Mirror MoonrakerAdapter.baseUrl's scheme choice: a bare IP/localhost is a
  // LAN box (http), a domain is usually behind a reverse proxy (https).
  const explicitHttps = /^https:\/\//.test(raw);
  const explicitHttp = /^http:\/\//.test(raw);
  const isDirectHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost';
  const scheme = explicitHttps || (!explicitHttp && !isDirectHost) ? 'https' : 'http';
  const port = Number(printer.port) || 0;
  // 7125 is Moonraker's API port; Mainsail/Fluidd sit on the plain web port.
  const webPort = port && port !== 7125 ? port : 0;
  return webPort ? `${scheme}://${host}:${webPort}` : `${scheme}://${host}`;
}

function plainHttpUrl(defaultPort) {
  return (printer) => {
    const host = stripScheme(printer.host);
    if (!host) return null;
    return `http://${host}:${Number(printer.port) || defaultPort}`;
  };
}

const WEB_URL_BY_TYPE = {
  moonraker: moonrakerWebUrl,
  duet: plainHttpUrl(80),
  repetierserver: plainHttpUrl(3344),
};

function printerWebUrl(printer = {}) {
  const urlFn = WEB_URL_BY_TYPE[printer.type];
  return urlFn ? urlFn(printer) : null;
}

function bambuStudioCandidates(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    return [
      env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs', 'BambuStudio', 'bambu-studio.exe'),
      env.ProgramFiles && path.win32.join(env.ProgramFiles, 'Bambu Studio', 'bambu-studio.exe'),
    ].filter(Boolean);
  }
  if (platform === 'darwin') return ['/Applications/BambuStudio.app'];
  return [];
}

module.exports = { printerWebUrl, bambuStudioCandidates };
