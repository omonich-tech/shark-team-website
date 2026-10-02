import { readdirSync } from "node:fs";
import { join } from "node:path";
import { EXPECTED_LATEST_MIGRATION } from "../src/server/database/schema-version";

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const migrations = readdirSync(migrationsDir, {
  withFileTypes: true
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const latest = migrations.at(-1);

if (!latest) {
  throw new Error("No Prisma migrations found");
}

if (latest !== EXPECTED_LATEST_MIGRATION) {
  throw new Error(
    "Schema version constant is stale: expected latest " +
      latest +
      ", got " +
      EXPECTED_LATEST_MIGRATION
  );
}

console.log(
  "Schema version contract is current:",
  EXPECTED_LATEST_MIGRATION
);
