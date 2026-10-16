import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";

const prisma = getPrisma();

function requiredDate(name: "SESSION_FROM" | "SESSION_TO") {
  const value = process.env[name];
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must be set as YYYY-MM-DD for session verification.`);
  }
  return value;
}

async function main() {
  const from = requiredDate("SESSION_FROM");
  const to = requiredDate("SESSION_TO");

  const sessions = await prisma.trainingSession.findMany({
    where: {
      group: {
        branchId: "BR-SCHOOL-117-01"
      },
      sourceDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`)
      }
    },
    include: {
      group: true,
      scheduleRule: true
    },
    orderBy: {
      startsAt: "asc"
    }
  });

  if (sessions.length !== 18) {
    throw new Error(`Expected 18 generated sessions, got ${sessions.length}`);
  }

  if (
    sessions.some(
      (session) =>
        session.trialCapacity !== null || session.trialBookingEnabled !== false
    )
  ) {
    throw new Error(
      "Trial booking must remain disabled while trial capacity is unconfirmed."
    );
  }

  if (sessions.some((session) => session.scheduleRuleId === null)) {
    throw new Error("Every generated session must reference its schedule rule.");
  }

  const expectedHoursByAge = new Map([
    ["6-8", 12],
    ["9-11", 13],
    ["12-15", 14]
  ]);

  for (const session of sessions) {
    const key = `${session.group.ageMin}-${session.group.ageMax}`;
    const expectedUtcHour = expectedHoursByAge.get(key);

    if (expectedUtcHour === undefined) {
      throw new Error(`Unexpected age group ${key}`);
    }

    if (session.startsAt.getUTCHours() !== expectedUtcHour) {
      throw new Error(
        `Unexpected UTC start time for ${key}: ${session.startsAt.toISOString()}`
      );
    }
  }

  console.log("Generated session verification passed.");
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
