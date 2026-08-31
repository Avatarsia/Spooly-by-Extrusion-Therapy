const dgram = require('node:dgram');
const os = require('node:os');

const MULTICAST_HOST = '239.255.255.250';
const DISCOVERY_PORTS = [1900, 1990, 2021];
const DEVICE_TYPE = 'urn:bambulab-com:device:3dprinter:1';

function parseDiscoveryPacket(payload, sender = {}) {
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
  if (!text.toLowerCase().includes(DEVICE_TYPE)) return null;
  const headers = {};
  text.split(/\r?\n/).slice(1).forEach((line) => {
    const colon = line.indexOf(':');
    if (colon < 1) return;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  });
  const host = (headers.location || sender.address || '').replace(/^https?:\/\//, '').split('/')[0];
  const serial = headers.usn || '';
  if (!host || !serial) return null;
  return {
    host,
    serial,
    model: headers['devmodel.bambu.com'] || '',
    name: headers['devname.bambu.com'] || `Bambu ${serial.slice(-4)}`,
    connection: headers['devconnect.bambu.com'] || '',
  };
}

function localIPv4Addresses() {
  return Object.values(os.networkInterfaces()).flat().filter((address) =>
    address && address.family === 'IPv4' && !address.internal
  ).map((address) => address.address);
}

function scanBambuPrinters(timeoutMs = 3200) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const found = new Map();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { socket.close(); } catch (_) {}
      resolve([...found.values()].sort((a, b) => a.name.localeCompare(b.name)));
    };
    socket.on('message', (payload, sender) => {
      const printer = parseDiscoveryPacket(payload, sender);
      if (printer) found.set(printer.serial, printer);
    });
    socket.on('error', finish);
    socket.bind(0, '0.0.0.0', () => {
      const interfaces = [null, ...localIPv4Addresses()];
      interfaces.forEach((address) => {
        try { if (address) socket.setMulticastInterface(address); } catch (_) {}
        DISCOVERY_PORTS.forEach((port) => {
          const request = Buffer.from([
            'M-SEARCH * HTTP/1.1',
            `HOST: ${MULTICAST_HOST}:${port}`,
            'MAN: "ssdp:discover"',
            'MX: 1',
            `ST: ${DEVICE_TYPE}`,
            '', '',
          ].join('\r\n'));
          socket.send(request, port, MULTICAST_HOST, () => {});
        });
      });
      setTimeout(finish, timeoutMs);
    });
  });
}

module.exports = { parseDiscoveryPacket, scanBambuPrinters };
