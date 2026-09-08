(function attachStatusLabel(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpoolyStatusLabel = api;
}(typeof globalThis !== 'undefined' ? globalThis : null, () => {
  const STATUS_LABELS = {
    filament_out: 'FILAMENT OUT',
    printing: 'PRINTING',
    paused: 'PAUSED',
    complete: 'COMPLETE',
    error: 'ERROR',
    idle: 'IDLE',
    offline: 'OFFLINE',
  };

  function hasNumericValue(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  function formatRemainingTime(value) {
    if (!hasNumericValue(value) || Number(value) <= 0) return '';
    const minutes = Math.max(1, Math.round(Number(value)));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours) return `${minutes}m left`;
    return remainder ? `${hours}h ${remainder}m left` : `${hours}h left`;
  }

  function printerStatusLabel(printer = {}) {
    if (printer.attention?.type === 'stopped') return 'PRINT STOPPED';
    const status = STATUS_LABELS[printer.status] || String(printer.status || '').toUpperCase();
    const active = ['printing', 'paused'].includes(printer.status);
    const details = active && hasNumericValue(printer.progress)
      ? [`${Math.round(Number(printer.progress))}%`]
      : [];
    const remaining = active ? formatRemainingTime(printer.remainingMinutes) : '';
    if (remaining) details.push(remaining);
    return details.length ? `${status} · ${details.join(' · ')}` : status;
  }

  return { formatRemainingTime, printerStatusLabel };
}));
