import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";

const prisma = getPrisma();

async function main() {
  const groupId = "GR-BASK-S117-0911-01";

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
