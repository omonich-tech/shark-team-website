import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { processDueTelegramNotifications } from "../src/server/notifications/telegram-notifications";

const prisma = getPrisma();

processDueTelegramNotifications()
  .then(async (result) => {
    console.log(result);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
