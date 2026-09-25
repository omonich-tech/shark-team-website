import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { id: "BR-SCHOOL-117-01" },
    include: {
      groups: {
        include: {
          scheduleRules: true,
          primaryCoach: true,
          sport: true
        },
        orderBy: { ageMin: "asc" }
      },
      prices: true
    }
  });

  assert(branch, "School 117 branch was not seeded");
  assert(branch.groups.length === 3, "Expected exactly 3 School 117 groups");
  assert(
    branch.groups.reduce(
      (total, group) => total + group.scheduleRules.length,
      0
    ) === 9,
    "Expected 9 weekly schedule rules"
  );
  assert(
    branch.groups.every((group) => group.capacityRegular === 20),
    "Every group must have regular capacity 20"
  );
  assert(
    branch.groups.every((group) => group.capacityTrial === null),
    "Trial capacity must remain unset until confirmed"
  );
  assert(
    branch.groups.every((group) => group.primaryCoach.id === "CO-0001"),
    "Every initial group must be linked to Dilshod"
  );

  const amounts = branch.prices.map((price) => price.amount).sort((a, b) => a - b);

  assert(
    amounts.length === 2 && amounts[0] === 50000 && amounts[1] === 500000,
    "Expected trial and subscription prices"
  );

  console.log("Core data verification passed.");
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
