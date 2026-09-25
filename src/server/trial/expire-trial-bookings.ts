import { TrialBookingStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function expireTrialBookings(now = new Date()) {
  const prisma = getPrisma();

  const result = await prisma.trialBooking.updateMany({
    where: {
      status: TrialBookingStatus.HOLD,
      expiresAt: { lte: now }
    },
    data: {
      status: TrialBookingStatus.EXPIRED
    }
  });

  return result.count;
}
