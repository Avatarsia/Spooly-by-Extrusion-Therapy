const ATTENTION_STATUSES = new Set(['paused', 'filament_out', 'error']);

function fleetLayout(count = 0) {
  const total = Math.max(0, Number(count) || 0);
  if (!total) return { columns: 1, rows: 1 };
  const columns = Math.min(3, Math.max(1, Math.ceil(total / 4)));
  return { columns, rows: Math.ceil(total / columns) };
}

function attentionFor(printer) {
  if (!printer) return null;
  const type = printer.attention?.type || (ATTENTION_STATUSES.has(printer.status) ? printer.status : null);
  if (!type) return null;
  const fallback = {
    paused: 'paused',
    filament_out: 'filament out',
    error: 'printer error',
    stopped: 'print stopped',
  }[type] || type.replaceAll('_', ' ');
  const message = String(printer.attention?.message || printer.message || fallback).trim();
  return {
    type,
    message,
    key: `${type}:${message.toLowerCase()}`,
  };
}

function isNewAttention(previous, next) {
  const current = attentionFor(next);
  if (!current) return false;
  return current.key !== attentionFor(previous)?.key;
}

module.exports = { attentionFor, fleetLayout, isNewAttention };
