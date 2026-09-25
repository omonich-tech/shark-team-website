import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  sharkPrisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? "3");
  const max =
    Number.isInteger(configuredMax) && configuredMax > 0
      ? configuredMax
      : 3;

  const adapter = new PrismaPg({
    connectionString,
    max,
    idleTimeoutMillis: 10_000
  });

  return new PrismaClient({ adapter });
}

export function getPrisma() {
  if (!globalForPrisma.sharkPrisma) {
    globalForPrisma.sharkPrisma = createPrismaClient();
  }

  return globalForPrisma.sharkPrisma;
}
