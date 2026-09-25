import { calculateTrialHoldWindow } from "../src/server/trial/calculate-hold-window";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const now = new Date("2026-09-25T10:00:00.000Z");

const standard = calculateTrialHoldWindow(
  new Date("2026-09-26T10:00:00.000Z"),
  now
);

assert(standard.mode === "STANDARD", "Expected standard hold");
assert(
  standard.expiresAt.toISOString() === "2026-09-25T12:00:00.000Z",
  "Standard hold must last 2 hours"
);
assert(
  standard.reminderAt?.toISOString() === "2026-09-25T11:00:00.000Z",
  "Standard reminder must be scheduled after 1 hour"
);

const short = calculateTrialHoldWindow(
  new Date("2026-09-25T12:00:00.000Z"),
  now
);

assert(short.mode === "SHORT", "Expected short hold under 3 hours");
assert(
  short.expiresAt.toISOString() === "2026-09-25T10:30:00.000Z",
  "Short hold must last 30 minutes"
);
assert(short.reminderAt === null, "Short hold must not schedule 1-hour reminder");

const nearStart = calculateTrialHoldWindow(
  new Date("2026-09-25T10:20:00.000Z"),
  now
);

assert(
  nearStart.expiresAt.toISOString() === "2026-09-25T10:20:00.000Z",
  "A hold must never extend beyond session start"
);

console.log("Trial hold window verification passed.");
