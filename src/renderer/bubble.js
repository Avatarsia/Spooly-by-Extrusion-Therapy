const bubble = document.querySelector('#bubble');
const resizeHandle = document.querySelector('#resizeHandle');
const rowResizeHandle = document.querySelector('#rowResizeHandle');
const closeBubble = document.querySelector('#closeBubble');
let resizing = false;
let rowResizing = false;

function escapeHtml(value = '') {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function label(printer) {
  if (printer.attention?.type === 'stopped') return 'PRINT STOPPED';
  const status = ({ filament_out: 'FILAMENT OUT', printing: 'PRINTING', paused: 'PAUSED', complete: 'COMPLETE', error: 'ERROR', idle: 'IDLE', offline: 'OFFLINE' })[printer.status] || printer.status;
  const showProgress = ['printing', 'paused'].includes(printer.status) && hasNumericValue(printer.progress);
  return showProgress ? `${status} · ${Math.round(Number(printer.progress))}%` : status;
}

function hasNumericValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function temperature(current, target) {
  if (!hasNumericValue(current)) return null;
  const rounded = Math.round(Number(current));
  return hasNumericValue(target) && Number(target) > 0
    ? `${rounded}°/${Math.round(Number(target))}°`
    : `${rounded}°`;
}

function fanStatuses(fans = []) {
  return fans.map((fan) => `${fan.label || 'FAN'} ${fan.on ? 'ON' : 'OFF'}`);
}

function progressBar(printer) {
  const problem = ['error', 'filament_out'].includes(printer.status);
  if (!problem && !['printing', 'paused', 'complete'].includes(printer.status)) return '';
  if (['printing', 'paused'].includes(printer.status) && !hasNumericValue(printer.progress)) return '';
  const value = problem || printer.status === 'complete'
    ? 100
    : Math.max(0, Math.min(100, Number(printer.progress) || 0));
  const kind = problem ? 'problem' : printer.status;
  return `<span class="progress ${kind}" aria-hidden="true"><i style="width:${value}%"></i></span>`;
}

function renderRow(printer) {
  // Keep idle telemetry clean and consistent. During an active or paused job,
  // show measured/target temperatures for every printer that supplies them.
  const showTargets = ['printing', 'paused'].includes(printer.status);
  const nozzle = temperature(printer.nozzleTemp, showTargets ? printer.nozzleTarget : null);
  const bed = temperature(printer.bedTemp, showTargets ? printer.bedTarget : null);
  const fans = fanStatuses(printer.fans);
  const telemetryItems = [
    nozzle && `<span class="nozzle">NOZZLE ${escapeHtml(nozzle)}</span>`,
    bed && `<span class="bed">BED ${escapeHtml(bed)}</span>`,
    ...fans.map((fan) => `<span class="fans">${escapeHtml(fan)}</span>`),
  ].filter(Boolean);
  const telemetry = telemetryItems.length
    ? `<span class="telemetry">${telemetryItems.join('')}</span>`
    : '';
  const statusKind = printer.attention?.type === 'stopped' ? 'stopped' : printer.status;
  return `<div class="row"><button class="name" type="button" data-id="${escapeHtml(printer.id)}" title="Open printer">${escapeHtml(printer.name)}</button><span class="status ${escapeHtml(statusKind)}">${escapeHtml(label(printer))}</span>
    ${(printer.message || printer.attention?.message) ? `<span class="message">${escapeHtml(printer.message || printer.attention.message)}</span>` : ''}${progressBar(printer)}${telemetry}</div>`;
}

// The exact pixel height of the errors block, the per-row grid tracks, the
// container padding, and the block gap all depend on real font metrics,
// wrapped telemetry, and border rounding — too fragile to guess as constants
// in the main process. Measure the actual layout here instead and report it
// back, so the window is sized from truth rather than an approximation.
// getComputedStyle/getBoundingClientRect report authored CSS-px values (e.g.
// a `min-height: 94px` row always measures as 94), unaffected by Electron's
// setZoomFactor — zoom only changes how many of those CSS px fit in the
// physical window. main.js multiplies this natural (zoom = 1) total by
// bubbleScale, so these values must be reported as-measured.
function reportBubbleMetrics() {
  const style = getComputedStyle(bubble);
  const bodyStyle = getComputedStyle(document.body);
  const paddingV = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  // #bubble's height:100% resolves against <body>'s content box, so body's
  // own padding shrinks #bubble below the window's real height unless it is
  // added back here — the window itself has no padding of its own.
  const bodyPaddingV = (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0);
  const gap = parseFloat(style.rowGap) || parseFloat(style.gap) || 0;
  const errorsEl = bubble.querySelector('.bubble-errors');
  const restEl = bubble.querySelector('.bubble-rest');
  const errorsHeight = errorsEl ? errorsEl.getBoundingClientRect().height : 0;
  const rowHeights = restEl
    ? getComputedStyle(restEl).gridTemplateRows.split(' ').map(parseFloat).filter(Number.isFinite)
    : [];
  window.spooly.reportBubbleMetrics({ paddingV, bodyPaddingV, gap, errorsHeight, rowHeights });
}

window.spooly.onBubbleUpdate(({ attention, rest, side, layout }) => {
  document.body.className = side;
  if (!attention.length && !rest.length) {
    bubble.innerHTML = '<strong>Time for some extrusion therapy?</strong><br>Let’s add your first printer.';
    return;
  }
  const errorsBlock = attention.length ? `<div class="bubble-errors">${attention.map(renderRow).join('')}</div>` : '';
  const restBlock = rest.length ? `<div class="bubble-rest">${rest.map(renderRow).join('')}</div>` : '';
  bubble.innerHTML = errorsBlock + restBlock;
  // #bubble is never recreated, only its children — its scrollTop survives
  // across updates. Pin it back to the top so errors and the soonest-to-
  // finish printer never drift out of view because of a stale scroll offset.
  bubble.scrollTop = 0;
  const restEl = bubble.querySelector('.bubble-rest');
  if (restEl) {
    restEl.style.setProperty('--columns', layout.columns);
    restEl.style.setProperty('--rows', layout.rows);
  }
  reportBubbleMetrics();
});

closeBubble.addEventListener('click', () => window.spooly.hideBubble());

bubble.addEventListener('click', (event) => {
  const name = event.target.closest('.name');
  if (name?.dataset.id) window.spooly.openPrinter(name.dataset.id);
});

bubble.addEventListener('mouseenter', () => window.spooly.setBubbleHovered(true));
bubble.addEventListener('mouseleave', () => window.spooly.setBubbleHovered(false));

resizeHandle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizing = true;
  resizeHandle.setPointerCapture(event.pointerId);
  window.spooly.beginBubbleResize();
  event.preventDefault();
});

resizeHandle.addEventListener('pointermove', (event) => {
  if (!resizing) return;
  window.spooly.moveBubbleResize();
  event.preventDefault();
});

function finishResize(event) {
  if (!resizing) return;
  resizing = false;
  if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
  window.spooly.endBubbleResize();
  event.preventDefault();
}

resizeHandle.addEventListener('pointerup', finishResize);
resizeHandle.addEventListener('pointercancel', finishResize);

rowResizeHandle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  rowResizing = true;
  rowResizeHandle.setPointerCapture(event.pointerId);
  window.spooly.beginRowResize();
  event.preventDefault();
});

rowResizeHandle.addEventListener('pointermove', (event) => {
  if (!rowResizing) return;
  window.spooly.moveRowResize();
  event.preventDefault();
});

function finishRowResize(event) {
  if (!rowResizing) return;
  rowResizing = false;
  if (rowResizeHandle.hasPointerCapture(event.pointerId)) rowResizeHandle.releasePointerCapture(event.pointerId);
  window.spooly.endRowResize();
  event.preventDefault();
}

rowResizeHandle.addEventListener('pointerup', finishRowResize);
rowResizeHandle.addEventListener('pointercancel', finishRowResize);
