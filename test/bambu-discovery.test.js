const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDiscoveryPacket } = require('../src/discovery/bambu');

test('parses a Bambu SSDP discovery announcement', () => {
  const packet = [
    'NOTIFY * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'Location: 192.168.1.64',
    'NT: urn:bambulab-com:device:3dprinter:1',
    'USN: 01S00A123456789',
    'DevModel.bambu.com: 3DPrinter-X1-Carbon',
    'DevName.bambu.com: Workshop X1C',
    'DevConnect.bambu.com: cloud',
    '', '',
  ].join('\r\n');
  assert.deepEqual(parseDiscoveryPacket(packet), {
    host: '192.168.1.64',
    serial: '01S00A123456789',
    model: '3DPrinter-X1-Carbon',
    name: 'Workshop X1C',
    connection: 'cloud',
  });
});

test('ignores unrelated SSDP traffic', () => {
  assert.equal(parseDiscoveryPacket('NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\n'), null);
});
