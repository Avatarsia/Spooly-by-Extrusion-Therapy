const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateLegacyCredentials, preparePrintersForStorage } = require('../src/credentials');

test('keeps plaintext access codes in Application Support storage', () => {
  const source = [{ id: 'x1c', type: 'bambu', accessCode: '12345678' }];
  assert.deepEqual(preparePrintersForStorage(source), source);
});

test('removes the legacy Keychain ciphertext without removing its printer', () => {
  const source = [{ id: 'x1c', type: 'bambu', host: '192.168.1.2', accessCode: 'enc:abc123' }];
  const result = migrateLegacyCredentials(source);
  assert.equal(result.changed, true);
  assert.deepEqual(result.printers, [{
    id: 'x1c',
    type: 'bambu',
    host: '192.168.1.2',
    accessCode: '',
    accessCodeNeedsReentry: true,
  }]);
});

test('clears the one-time re-entry marker after a new code is saved', () => {
  const stored = preparePrintersForStorage([{
    id: 'x1c', type: 'bambu', accessCode: '87654321', accessCodeNeedsReentry: true,
  }]);
  assert.deepEqual(stored, [{ id: 'x1c', type: 'bambu', accessCode: '87654321' }]);
});
