import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { generateTrainingSessions } from "../src/server/sessions/generate-training-sessions";

function tashkentToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const from = process.env.SESSION_FROM ?? tashkentToday();
const to = process.env.SESSION_TO ?? addDays(from, 84);
const branchId = process.env.SESSION_BRANCH_ID || undefined;

const prisma = getPrisma();

generateTrainingSessions(prisma, {
  from,
  to,
  branchId
})
  .then(async (result) => {
    console.log(
      `Session generation complete: considered=${result.considered}, created=${result.created}, from=${from}, to=${to}`
    );
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
