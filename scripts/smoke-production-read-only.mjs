/**
 * Read-only production smoke test.
 * No authenticated requests, writes, payments, lead creation or database mutations.
 * Usage: SMOKE_BASE_URL=https://sharkteam.uz npm run smoke:production:read-only
 */
const rawBaseUrl = process.env.SMOKE_BASE_URL ?? "https://sharkteam.uz";
const baseUrl = new URL(rawBaseUrl);
if (!["https:", "http:"].includes(baseUrl.protocol)) {
  throw new Error("SMOKE_BASE_URL must be http(s)");
}
const paths = [
  "/api/health",
  "/api/ready",
  "/ru",
  "/uz",
  "/ru/trial",
  "/uz/trial",
  "/robots.txt",
  "/sitemap.xml"
];
let failures = 0;
for (const path of paths) {
  try {
    const url = new URL(path, baseUrl);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "SharkTeamReadOnlySmoke/1.0" }
    });
    const ok = response.ok && response.status < 400;
    console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}`);
    if (!ok) failures++;
  } catch (error) {
    console.error(`FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`);
    failures++;
  }
}
if (failures) {
  console.error(`Read-only production smoke failed: ${failures} endpoint(s)`);
  process.exitCode = 1;
} else {
  console.log("Read-only production smoke passed. No data was modified.");
}
