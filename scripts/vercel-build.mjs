import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL_ENV === "production") {
  console.log("Production build: applying Prisma migrations.");
  run("npm", ["run", "db:migrate:deploy"]);
} else {
  console.log(
    "Non-production build: skipping production database migrations."
  );
}

run("npm", ["run", "build"]);
