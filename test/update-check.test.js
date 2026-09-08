const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, versionParts } = require('../src/update-check');

test('release versions accept a GitHub v prefix', () => {
  assert.deepEqual(versionParts('v0.1.13'), [0, 1, 13]);
});

test('release versions compare numerically', () => {
  assert.equal(compareVersions('0.1.13', '0.1.12'), 1);
  assert.equal(compareVersions('0.1.12', '0.1.12'), 0);
  assert.equal(compareVersions('0.1.9', '0.1.12'), -1);
});

test('unparseable release versions are not treated as current', () => {
  assert.throws(() => compareVersions('latest', '0.1.15'), /Invalid release version/);
  assert.equal(versionParts('latest'), null);
});
