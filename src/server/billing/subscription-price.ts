import { PriceProductType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { findEffectiveGroupPrice } from "@/server/public-data/pricing";

export async function findSubscriptionPrice(
  groupId: string,
  now = new Date()
) {
  const prisma = getPrisma();
  const group = await prisma.trainingGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      branchId: true,
      sportId: true
    }
  });

  if (!group) return null;

  return findEffectiveGroupPrice(
    prisma,
    group,
    PriceProductType.SUBSCRIPTION,
    now
  );
}
