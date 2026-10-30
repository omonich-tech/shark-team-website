import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { LifecycleStatus, PriceProductType } from "../src/generated/prisma/client";

const prisma = getPrisma();

async function main() {
  const groupId = "GR-BASK-S117-0911-01";

  // These legacy HOLD/expiry tests require a paid trial. The production
  // default remains free; this override exists only in the isolated CI database.
  await prisma.price.upsert({
    where: { id: "PRICE-CI-TRIAL-BASK-S117" },
    update: {
      amount: 50_000,
      status: LifecycleStatus.ACTIVE,
      validFrom: new Date("2020-01-01T00:00:00.000Z"),
      validTo: null
    },
    create: {
      id: "PRICE-CI-TRIAL-BASK-S117",
      productType: PriceProductType.TRIAL,
      amount: 50_000,
      groupId,
      status: LifecycleStatus.ACTIVE,
      validFrom: new Date("2020-01-01T00:00:00.000Z")
    }
  });

  await prisma.trainingGroup.update({
    where: { id: groupId },
    data: { capacityTrial: 2 }
  });

  const result = await prisma.trainingSession.updateMany({
    where: {
      groupId,
      startsAt: { gt: new Date() }
    },
    data: {
      trialCapacity: 2,
      trialBookingEnabled: true
    }
  });

  if (result.count === 0) {
    throw new Error("No future sessions were prepared for booking smoke tests.");
  }

  console.log(`Prepared ${result.count} sessions for booking smoke tests.`);
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
