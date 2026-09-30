import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

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
      productType: PriceProductType.SUBSCRIPTION,
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
      AND: [
        {
          OR: [
            { groupId: group.id },
            {
              groupId: null,
              branchId: group.branchId,
              sportId: group.sportId
            },
            {
              groupId: null,
              branchId: group.branchId,
              sportId: null
            },
            {
              groupId: null,
              branchId: null,
              sportId: group.sportId
            }
          ]
        }
      ]
    },
    orderBy: { validFrom: "desc" }
  });

  return (
    prices.find((item) => item.groupId === group.id) ??
    prices.find(
      (item) =>
        item.branchId === group.branchId &&
        item.sportId === group.sportId
    ) ??
    prices.find((item) => item.branchId === group.branchId) ??
    prices.find((item) => item.sportId === group.sportId) ??
    null
  );
}
