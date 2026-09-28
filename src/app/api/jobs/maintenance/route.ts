import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/timezone";
import { isCronAuthorized } from "@/server/jobs/auth";
import { generateTrainingSessions } from "@/server/sessions/generate-training-sessions";
import { expireTrialBookings } from "@/server/trial/expire-trial-bookings";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const prisma = getPrisma();
    const now = new Date();
    const from = dateKeyInTimeZone(now, "Asia/Tashkent");
    const to = addDays(from, horizonDays());
    const technicalCutoff = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    const expiredHolds = await expireTrialBookings(now);
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

    return NextResponse.json({
      ok: true,
      now: now.toISOString(),
      range: { from, to },
      expiredHolds,
      sessions,
      cleanup: {
        rateLimitBuckets: oldRateLimits.count,
        telegramLinkTokens: oldLinkTokens.count
      }
    });
  } catch (error) {
    console.error("Maintenance job failed", error);

    return NextResponse.json(
      { ok: false, error: "MAINTENANCE_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
