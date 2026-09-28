import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { runMaintenance } from "../src/server/jobs/run-maintenance";

const prisma = getPrisma();

runMaintenance()
  .then(async (result) => {
    console.log(JSON.stringify(result, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
