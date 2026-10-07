import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";

const prisma = getPrisma();

async function main() {
  const groupId = "GR-BASK-S117-0911-01";
  const capacity = 10;

  await prisma.trainingGroup.update({
    where: { id: groupId },
    data: { capacityTrial: capacity }
  });

  const result = await prisma.trainingSession.updateMany({
    where: {
      groupId,
      startsAt: { gt: new Date() }
    },
    data: {
      trialCapacity: capacity,
      trialBookingEnabled: true
    }
  });

  if (result.count === 0) {
    throw new Error("No future sessions were prepared for Payme smoke test.");
  }

  console.log(
    `Prepared ${result.count} future sessions with trial capacity ${capacity} for Payme smoke.`
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
