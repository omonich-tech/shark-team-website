import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  sharkPrisma?: PrismaClient;
};

export function getPrisma() {
  if (globalForPrisma.sharkPrisma) {
    return globalForPrisma.sharkPrisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.sharkPrisma = prisma;
  }

  return prisma;
}
