const test = require('node:test');
const assert = require('node:assert/strict');
const { clampScale, scaledSize, topRightResize } = require('../src/bubble-resize');

test('popup scale is bounded and sizes remain proportional', () => {
  assert.equal(clampScale(0.2), 0.65);
  assert.equal(clampScale(2), 1.6);
  assert.deepEqual(scaledSize({ width: 400, height: 300 }, 1.25), { width: 500, height: 375 });
});

test('top-right resize scales the whole popup and anchors its lower-left corner', () => {
  const result = topRightResize({
    startCursor: { x: 500, y: 200 },
    startBounds: { x: 100, y: 100, width: 400, height: 300 },
    point: { x: 580, y: 140 },
    baseSize: { width: 400, height: 300 },
  });
  assert.ok(result.scale > 1);
  assert.equal(result.bounds.x, 100);
  assert.equal(result.bounds.y + result.bounds.height, 400);
  assert.equal(result.bounds.width / 400, result.bounds.height / 300);
});
