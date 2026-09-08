const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function automaticCheckDue(lastAttempt, now = Date.now(), intervalMs = WEEK_MS) {
  const last = Number(lastAttempt);
  return !Number.isFinite(last) || last <= 0 || last > now || now - last >= intervalMs;
}

function shouldRunAutomaticUpdate(enabled, lastAttempt, now = Date.now()) {
  return Boolean(enabled) && automaticCheckDue(lastAttempt, now);
}

function shouldNotifyForUpdate(enabled, result, lastNotifiedVersion) {
  return Boolean(enabled)
    && Boolean(result?.updateAvailable)
    && Boolean(result?.latest)
    && result.latest !== lastNotifiedVersion;
}

module.exports = { WEEK_MS, automaticCheckDue, shouldNotifyForUpdate, shouldRunAutomaticUpdate };
