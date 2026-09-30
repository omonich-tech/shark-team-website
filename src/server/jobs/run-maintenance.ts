import { getPrisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/timezone";
import { generateTrainingSessions } from "@/server/sessions/generate-training-sessions";
import { backfillConfirmedTrialFamilies } from "@/server/trial/backfill-confirmed-trial-families";
import { expireTrialBookings } from "@/server/trial/expire-trial-bookings";

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function horizonDays() {
  const configured = Number(
    process.env.MAINTENANCE_SESSION_HORIZON_DAYS ?? "84"
  );

  return Number.isInteger(configured) &&
    configured >= 14 &&
    configured <= 365
    ? configured
    : 84;
}

export async function runMaintenance(now = new Date()) {
  const prisma = getPrisma();
  const from = dateKeyInTimeZone(now, "Asia/Tashkent");
  const to = addDays(from, horizonDays());
  const technicalCutoff = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  );

  const expiredHolds = await expireTrialBookings(now);
  const familyLinksRepaired = await backfillConfirmedTrialFamilies();
  const sessions = await generateTrainingSessions(prisma, {
    from,
    to
  });

  const [oldRateLimits, oldLinkTokens] = await Promise.all([
    prisma.rateLimitBucket.deleteMany({
      where: {
        resetAt: {
          lt: technicalCutoff
        }
      }
    }),
    prisma.telegramLinkToken.deleteMany({
      where: {
        expiresAt: {
          lt: technicalCutoff
        }
      }
    })
  ]);

  return {
    now: now.toISOString(),
    range: { from, to },
    expiredHolds,
    familyLinksRepaired,
    sessions,
    cleanup: {
      rateLimitBuckets: oldRateLimits.count,
      telegramLinkTokens: oldLinkTokens.count
    }
  };
}
