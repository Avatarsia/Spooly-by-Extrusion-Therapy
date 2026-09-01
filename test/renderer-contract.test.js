const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('preserves the mascot focus-ring suppression', () => {
  assert.match(source('src/renderer/pet.css'), /\.pet:focus\s*\{\s*outline:\s*none;/);
});

test('colors each printer status and telemetry category independently', () => {
  const script = source('src/renderer/bubble.js');
  const styles = source('src/renderer/bubble.css');
  assert.match(script, /statusKind/);
  assert.match(script, /class="nozzle"/);
  assert.match(script, /class="bed"/);
  assert.match(script, /class="fans"/);
  assert.match(styles, /\.status\.printing, \.status\.complete/);
  assert.match(styles, /\.status\.paused/);
  assert.match(styles, /\.status\.error, \.status\.filament_out, \.status\.stopped/);
  assert.match(styles, /\.telemetry \.nozzle/);
  assert.match(styles, /\.telemetry \.bed/);
  assert.match(styles, /\.telemetry \.fans/);
  assert.match(styles, /\.telemetry \{[^}]*font-size:\s*10px/);
});

test('wraps complete telemetry readings instead of truncating fan values', () => {
  const script = source('src/renderer/bubble.js');
  const main = source('src/main.js');
  const styles = source('src/renderer/bubble.css');
  assert.match(script, /\.\.\.fans\.map\(\(fan\) => `<span class="fans">/);
  assert.match(main, /telemetryLength\(printer\)/);
  assert.match(main, /\.\.\.\(printer\.fans \|\| \[\]\)\.map/);
  assert.match(styles, /\.telemetry \{[^}]*flex-wrap:\s*wrap/);
  assert.match(styles, /\.telemetry > span \{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(styles, /\.telemetry \{[^}]*text-overflow:\s*ellipsis/);
});

test('omits missing numeric telemetry instead of converting it to zero', () => {
  const script = source('src/renderer/bubble.js');
  assert.match(script, /value !== null && value !== undefined && value !== ''/);
  assert.match(script, /!hasNumericValue\(printer\.progress\)/);
  assert.match(script, /!hasNumericValue\(current\)/);
});

test('shows temperature targets only while printing or paused', () => {
  const script = source('src/renderer/bubble.js');
  assert.match(script, /const showTargets = \['printing', 'paused'\]\.includes\(printer\.status\)/);
  assert.match(script, /temperature\(printer\.nozzleTemp, showTargets \? printer\.nozzleTarget : null\)/);
  assert.match(script, /temperature\(printer\.bedTemp, showTargets \? printer\.bedTarget : null\)/);
});

test('shows the packaged version and prepends user-added printer cards', () => {
  const main = source('src/main.js');
  const settings = source('src/renderer/settings.js');
  assert.match(main, /version: app\.getVersion\(\)/);
  assert.match(settings, /Version \$\{settings\.version\}/);
  assert.match(settings, /prepend: true, focus: true/);
  assert.match(settings, /if \(prepend\) list\.prepend\(card\)/);
});

test('dragging cancels hover scaling and hard-locks the pet window size', () => {
  const pet = source('src/renderer/pet.js');
  const main = source('src/main.js');
  assert.match(pet, /pet\.addEventListener\('pointerdown',[\s\S]*?stopHoverReaction\(\)/);
  assert.match(pet, /if \(dragging \|\| !\['idle', 'complete'\]/);
  assert.match(main, /function enforcePetWindowSize\(\)/);
  assert.match(main, /petWindow\.setMinimumSize\(expected, expected\)/);
  assert.match(main, /petWindow\.setMaximumSize\(expected, expected\)/);
  assert.match(main, /screen\.getCursorScreenPoint\(\)/);
  assert.match(main, /petWindow\.setBounds\(fixedBounds, false\);\s*schedulePetWindowSizeLock\(\)/);
  assert.doesNotMatch(main, /petWindow\.setPosition\(clamped\.x, clamped\.y, false\)/);
});
