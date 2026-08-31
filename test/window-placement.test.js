const test = require('node:test');
const assert = require('node:assert/strict');
const { clampBoundsToWorkArea, placementForBounds, resolveSavedBounds } = require('../src/window-placement');

const main = { id: 1, label: 'Built-in', bounds: { x: 0, y: 0, width: 1440, height: 900 }, workArea: { x: 0, y: 25, width: 1440, height: 825 } };
const external = { id: 2, label: 'Studio Display', bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, workArea: { x: -1920, y: 25, width: 1920, height: 1010 } };

test('clamps Spooly above the Dock and inside the display', () => {
  assert.deepEqual(clampBoundsToWorkArea({ x: 1300, y: 820, width: 230, height: 230 }, main.workArea), {
    x: 1210, y: 620, width: 230, height: 230,
  });
});

test('restores the saved external-monitor offset after wake', () => {
  const saved = placementForBounds({ x: -1880, y: 700, width: 230, height: 230 }, external);
  assert.deepEqual(resolveSavedBounds(saved, [main, external], main, 230), {
    x: -1880, y: 700, width: 230, height: 230,
  });
});
