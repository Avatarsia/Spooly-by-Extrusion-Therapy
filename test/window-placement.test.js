const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampBoundsToWorkArea,
  fixedSizeDragBounds,
  placementForBounds,
  resolveSavedBounds,
} = require('../src/window-placement');

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

test('keeps fixed dimensions through repeated mixed-DPI drag updates', () => {
  const workArea125 = { x: 1920, y: 0, width: 1536, height: 824 };
  const startBounds = { x: 100, y: 100, width: 230, height: 230 };
  const startCursor = { x: 150, y: 150 };

  for (let index = 0; index < 250; index += 1) {
    const bounds = fixedSizeDragBounds(
      startBounds,
      startCursor,
      { x: 2000 + index, y: 120 + index },
      workArea125,
      230,
    );
    assert.equal(bounds.width, 230);
    assert.equal(bounds.height, 230);
  }
});

test('clamps a fixed-size drag after crossing onto another display', () => {
  assert.deepEqual(fixedSizeDragBounds(
    { x: 1700, y: 700, width: 230, height: 230 },
    { x: 1800, y: 800 },
    { x: 3500, y: 1000 },
    { x: 1920, y: 0, width: 1536, height: 824 },
    230,
  ), {
    x: 3226,
    y: 594,
    width: 230,
    height: 230,
  });
});
