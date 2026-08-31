const test = require('node:test');
const assert = require('node:assert/strict');
const { ipv4ToInt, intToIPv4, isPrivateIPv4, parseMoonrakerInfo } = require('../src/discovery/moonraker');

test('round trips IPv4 addresses used by the subnet scanner', () => {
  assert.equal(intToIPv4(ipv4ToInt('192.168.5.72')), '192.168.5.72');
});

test('limits active scanning to private IPv4 networks', () => {
  assert.equal(isPrivateIPv4('192.168.5.72'), true);
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
});

test('recognizes a Moonraker server response', () => {
  const printer = parseMoonrakerInfo({ result: {
    klippy_state: 'ready', moonraker_version: 'v0.9.3', hostname: 'voron.local',
    components: ['klippy_connection'],
  } }, '192.168.5.72', 7125);
  assert.deepEqual(printer, {
    host: '192.168.5.72', port: 7125, name: 'voron',
    klippyState: 'ready', moonrakerVersion: 'v0.9.3',
  });
});

test('labels Snapmaker Moonraker forks as a U1', () => {
  const printer = parseMoonrakerInfo({ result: {
    klippy_state: 'ready', moonraker_version: '1.4.1',
    components: ['klippy_connection', 'snapmakercloud'],
  } }, '192.168.5.72');
  assert.equal(printer.name, 'Snapmaker U1');
});

test('rejects an unrelated web server', () => {
  assert.equal(parseMoonrakerInfo({ result: { components: ['history'] } }, '192.168.5.10'), null);
});
