const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const STANDARD_HOLD_MS = 2 * HOUR_MS;
const STANDARD_REMINDER_MS = 1 * HOUR_MS;
const SHORT_HOLD_THRESHOLD_MS = 3 * HOUR_MS;
const SHORT_HOLD_MS = 30 * MINUTE_MS;

export function calculateTrialHoldWindow(startsAt: Date, now = new Date()) {
  const msUntilSession = startsAt.getTime() - now.getTime();

  if (msUntilSession <= 0) {
    throw new Error("SESSION_ALREADY_STARTED");
  }

  const shortHold = msUntilSession < SHORT_HOLD_THRESHOLD_MS;
  const holdDurationMs = shortHold ? SHORT_HOLD_MS : STANDARD_HOLD_MS;
  const expiresAtMs = Math.min(
    now.getTime() + holdDurationMs,
    startsAt.getTime()
  );

  return {
    expiresAt: new Date(expiresAtMs),
    reminderAt: shortHold
      ? null
      : new Date(now.getTime() + STANDARD_REMINDER_MS),
    mode: shortHold ? ("SHORT" as const) : ("STANDARD" as const)
  };
}
