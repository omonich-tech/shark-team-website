import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";

export type PriceCandidate = {
  id: string;
  productType: PriceProductType;
  amount: number;
  currency: string;
  sportId: string | null;
  branchId: string | null;
  groupId: string | null;
  validFrom: Date;
  validTo: Date | null;
  status: LifecycleStatus;
};

type PriceScope = {
  sportId?: string | null;
  branchId?: string | null;
  groupId?: string | null;
};

function scopeScore(price: PriceCandidate, scope: PriceScope) {
  if (price.groupId && price.groupId !== scope.groupId) return -1;
  if (price.branchId && price.branchId !== scope.branchId) return -1;
  if (price.sportId && price.sportId !== scope.sportId) return -1;

  let score = 0;
  if (price.sportId) score += 2;
  if (price.branchId) score += 4;
  if (price.groupId) score += 8;
  return score;
}

export function resolveEffectivePrice(
  prices: PriceCandidate[],
  productType: PriceProductType,
  scope: PriceScope
) {
  return prices
    .filter((price) => price.productType === productType)
    .map((price) => ({ price, score: scopeScore(price, scope) }))
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.price.validFrom.getTime() - a.price.validFrom.getTime()
    )[0]?.price ?? null;
}

export function activePriceWhere(now = new Date()) {
  return {
    status: LifecycleStatus.ACTIVE,
    validFrom: { lte: now },
    AND: [
      {
        OR: [{ validTo: null }, { validTo: { gt: now } }]
      }
    ]
  } as const;
}
