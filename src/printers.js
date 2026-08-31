function normalizeHost(value = '') {
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function canonicalPrinterKey(printer = {}) {
  if (printer.type === 'bambu') {
    const serial = String(printer.serial || '').trim().toUpperCase();
    if (serial) return `bambu:serial:${serial}`;
    const host = normalizeHost(printer.host);
    return host ? `bambu:host:${host}` : null;
  }
  if (printer.type === 'moonraker') {
    const host = normalizeHost(printer.host);
    return host ? `moonraker:${host}:${Number(printer.port) || 7125}` : null;
  }
  return null;
}

function dedupePrinters(printers = []) {
  const seen = new Set();
  return printers.filter((printer) => {
    const key = canonicalPrinterKey(printer);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { canonicalPrinterKey, dedupePrinters, normalizeHost };
