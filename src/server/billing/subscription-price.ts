import { PriceProductType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  activePriceWhere,
  resolveEffectivePrice
} from "@/server/public-data/pricing";

export async function findSubscriptionPrice(
  groupId: string,
  now = new Date()
) {
  const prisma = getPrisma();
  const group = await prisma.trainingGroup.findUnique({
    where: { id: groupId }
  });

  if (!group) return null;

  const prices = await prisma.price.findMany({
    where: {
      ...activePriceWhere(now),
      productType: PriceProductType.SUBSCRIPTION,
      OR: [
        { groupId: group.id },
        {
          groupId: null,
          branchId: group.branchId
        },
        {
          groupId: null,
          branchId: null,
          sportId: group.sportId
        }
      ]
    },
    orderBy: { validFrom: "desc" }
  });

  return resolveEffectivePrice(
    prices,
    PriceProductType.SUBSCRIPTION,
    {
      groupId: group.id,
      branchId: group.branchId,
      sportId: group.sportId
    }
  );
}
