const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldManageLoginItem, syncLaunchAtLogin } = require('../src/login-item');

test('development Electron never manages the operating-system login item', () => {
  const calls = [];
  const electronApp = {
    isPackaged: false,
    getPath: () => '/project/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    setLoginItemSettings: (settings) => calls.push(settings),
  };

  assert.equal(syncLaunchAtLogin(electronApp, true, 'darwin'), false);
  assert.deepEqual(calls, []);
});

test('packaged Spooly registers its current macOS app bundle', () => {
  const calls = [];
  const executablePath = '/Applications/Spooly.app/Contents/MacOS/Spooly';
  const electronApp = {
    isPackaged: true,
    getPath: () => executablePath,
    setLoginItemSettings: (settings) => calls.push(settings),
  };

  assert.equal(syncLaunchAtLogin(electronApp, true, 'darwin'), true);
  assert.deepEqual(calls, [{ openAtLogin: true }]);
});

test('packaged Spooly registers its exact Windows executable', () => {
  const calls = [];
  const executablePath = 'C:\\Program Files\\Spooly\\Spooly.exe';
  const electronApp = {
    isPackaged: true,
    getPath: () => executablePath,
    setLoginItemSettings: (settings) => calls.push(settings),
  };

  assert.equal(syncLaunchAtLogin(electronApp, true, 'win32'), true);
  assert.deepEqual(calls, [{ openAtLogin: true, path: executablePath }]);
});

test('a copy opened from a mounted DMG does not become a dead login item', () => {
  assert.equal(shouldManageLoginItem({
    isPackaged: true,
    platform: 'darwin',
    executablePath: '/Volumes/Spooly 0.1.4/Spooly.app/Contents/MacOS/Spooly',
  }), false);
});
