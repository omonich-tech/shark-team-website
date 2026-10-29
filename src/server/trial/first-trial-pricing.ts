import { PriceProductType } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { activePriceWhere } from "@/server/public-data/pricing";

/**
 * Business rule for the first trial:
 * - free (0 UZS) unless an explicit active group-level TRIAL price exists;
 * - only the group's current price may make its first trial paid;
 * - subscription prices and inherited branch/sport trial prices do not affect it.
 *
 * Use this policy in both booking and presentation paths so the parent
 * never sees a different amount from the amount the server charges.
 */
export async function resolveFirstTrialAmount(
  prisma: PrismaClient,
  groupId: string,
  now = new Date()
): Promise<number> {
  const price = await prisma.price.findFirst({
    where: {
      ...activePriceWhere(now),
      productType: PriceProductType.TRIAL,
      groupId
    },
    orderBy: { validFrom: "desc" },
    select: { amount: true }
  });
  return price?.amount ?? 0;
}

export function requiresFirstTrialPayment(amount: number): boolean {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("INVALID_TRIAL_AMOUNT");
  }
  return amount > 0;
}
