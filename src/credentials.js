function migrateLegacyCredentials(printers = []) {
  let changed = false;
  const migrated = printers.map((printer) => {
    const accessCode = String(printer?.accessCode || '');
    if (!accessCode.startsWith('enc:')) return printer;
    changed = true;
    // Beta 3 used Electron safeStorage, which can trigger a macOS Keychain
    // password prompt at every login when an ad-hoc build changes identity.
    // Do not touch safeStorage during migration: keep the printer and request
    // only its Bambu access code again.
    return { ...printer, accessCode: '', accessCodeNeedsReentry: true };
  });
  return { printers: migrated, changed };
}

function preparePrintersForStorage(printers = []) {
  return printers.map(({ accessCodeNeedsReentry: _ignored, ...printer }) => ({
    ...printer,
    accessCode: String(printer.accessCode || ''),
  }));
}

module.exports = { migrateLegacyCredentials, preparePrintersForStorage };
