import "dotenv/config";
import {
  LeadStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import { reserveTrialBooking } from "../src/server/trial/reserve-trial-booking";

const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const booking = await prisma.trialBooking.findFirst({
    where: {
      status: TrialBookingStatus.HOLD
    },
    include: {
      session: {
        include: {
          group: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  assert(booking, "Expected an active HOLD from the race smoke test");

  await prisma.trialBooking.update({
    where: { id: booking.id },
    data: {
      expiresAt: new Date(Date.now() - 60_000)
    }
  });

  const lead = await prisma.lead.create({
    data: {
      status: LeadStatus.TRIAL_SELECTED,
      parentName: "Expiry Parent",
      childName: "Expiry Child",
      phone: "+998901239999",
      childAge: 10,
      locale: "ru",
      source: "ci",
      branchId: booking.session.group.branchId,
      sportId: booking.session.group.sportId,
      groupId: booking.session.groupId,
      selectedSessionId: booking.sessionId,
      landingPage: "/ru/trial",
      utmSource: "ci",
      utmMedium: "expiry",
      utmCampaign: "expired-hold-reclaim"
    }
  });

  const replacement = await reserveTrialBooking(lead.id);

  assert(replacement.ok, "Expired HOLD did not free capacity");

  const expired = await prisma.trialBooking.findUnique({
    where: { id: booking.id }
  });

  assert(
    expired?.status === TrialBookingStatus.EXPIRED,
    "Stale HOLD was not marked EXPIRED"
  );

  const activeCount = await prisma.trialBooking.count({
    where: {
      sessionId: booking.sessionId,
      OR: [
        {
          status: TrialBookingStatus.CONFIRMED
        },
        {
          status: TrialBookingStatus.HOLD,
          expiresAt: { gt: new Date() }
        }
      ]
    }
  });

  assert(
    activeCount === booking.session.trialCapacity,
    "Replacement hold must restore capacity without overbooking"
  );

  console.log("Expired HOLD reclaim verification passed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
