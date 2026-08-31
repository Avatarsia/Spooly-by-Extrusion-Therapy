const http = require('node:http');
const os = require('node:os');
const { Bonjour } = require('bonjour-service');

const DEFAULT_PORT = 7125;
const MAX_SCAN_HOSTS = 4094;

function ipv4ToInt(address) {
  return address.split('.').reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

function intToIPv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function isPrivateIPv4(address) {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function localScanHosts() {
  const hosts = new Set();
  Object.values(os.networkInterfaces()).flat().forEach((entry) => {
    if (!entry || entry.family !== 'IPv4' || entry.internal || !entry.netmask || !isPrivateIPv4(entry.address)) return;
    const address = ipv4ToInt(entry.address);
    let mask = ipv4ToInt(entry.netmask);
    let network = (address & mask) >>> 0;
    let broadcast = (network | (~mask >>> 0)) >>> 0;
    if (broadcast - network - 1 > MAX_SCAN_HOSTS) {
      mask = ipv4ToInt('255.255.255.0');
      network = (address & mask) >>> 0;
      broadcast = (network | (~mask >>> 0)) >>> 0;
    }
    for (let candidate = network + 1; candidate < broadcast; candidate += 1) {
      if (candidate !== address) hosts.add(intToIPv4(candidate));
    }
  });
  return [...hosts];
}

function parseMoonrakerInfo(body, host, port = DEFAULT_PORT, advertisedName = '') {
  const result = body?.result;
  if (!result || (!result.moonraker_version && !result.components?.includes('klippy_connection'))) return null;
  const isSnapmaker = result.components?.some((component) => String(component).toLowerCase().includes('snapmaker'));
  const hostname = String(result.hostname || advertisedName || '').replace(/\.local$/i, '');
  return {
    host,
    port,
    name: hostname || (isSnapmaker ? 'Snapmaker U1' : `Klipper ${host.split('.').pop()}`),
    klippyState: result.klippy_state || '',
    moonrakerVersion: result.moonraker_version || '',
  };
}

function probeMoonraker(host, port = DEFAULT_PORT, timeoutMs = 650, advertisedName = '') {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value = null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = http.get({ host, port, path: '/server/info', timeout: timeoutMs }, (response) => {
      if (response.statusCode !== 200) { response.resume(); finish(); return; }
      let payload = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        payload += chunk;
        if (payload.length > 262144) request.destroy();
      });
      response.on('end', () => {
        try { finish(parseMoonrakerInfo(JSON.parse(payload), host, port, advertisedName)); }
        catch (_) { finish(); }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => finish());
    request.on('close', () => finish());
  });
}

async function discoverBonjour(timeoutMs = 2200) {
  const bonjour = new Bonjour();
  const browsers = [];
  const pending = new Set();
  const found = new Map();
  const onService = (service) => {
    const port = Number(service.port) || DEFAULT_PORT;
    (service.addresses || []).filter((address) => /^\d+\.\d+\.\d+\.\d+$/.test(address)).forEach((host) => {
      const task = probeMoonraker(host, port, 900, service.name).then((printer) => {
        if (printer) found.set(`${printer.host}:${printer.port}`, printer);
      }).finally(() => pending.delete(task));
      pending.add(task);
    });
  };
  for (const type of ['moonraker', 'snapmaker']) browsers.push(bonjour.find({ type, protocol: 'tcp' }, onService));
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  browsers.forEach((browser) => browser.stop());
  await Promise.allSettled([...pending]);
  bonjour.destroy();
  return [...found.values()];
}

async function discoverSubnet({ concurrency = 128 } = {}) {
  const hosts = localScanHosts();
  const found = [];
  let cursor = 0;
  async function worker() {
    while (cursor < hosts.length) {
      const printer = await probeMoonraker(hosts[cursor++]);
      if (printer) found.push(printer);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker));
  return found;
}

async function scanMoonrakerPrinters() {
  const results = await Promise.all([discoverBonjour(), discoverSubnet()]);
  const found = new Map();
  results.flat().forEach((printer) => found.set(`${printer.host}:${printer.port}`, printer));
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  DEFAULT_PORT,
  ipv4ToInt,
  intToIPv4,
  isPrivateIPv4,
  localScanHosts,
  parseMoonrakerInfo,
  probeMoonraker,
  discoverBonjour,
  discoverSubnet,
  scanMoonrakerPrinters,
};
