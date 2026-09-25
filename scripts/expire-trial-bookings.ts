import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { expireTrialBookings } from "../src/server/trial/expire-trial-bookings";

const prisma = getPrisma();

expireTrialBookings()
  .then(async (count) => {
    console.log(`Expired ${count} stale trial holds.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
