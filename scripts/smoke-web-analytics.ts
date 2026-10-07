import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Admin login did not return a cookie");
  return raw.split(";")[0];
}

async function post(body: Record<string, unknown>) {
  const response = await fetch(baseUrl + "/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      "Analytics collector failed: " +
        response.status +
        " " +
        JSON.stringify(payload)
    );
  }

  return response;
}

async function main() {
  assert(username && password, "Admin credentials are missing");

  const suffix = Date.now().toString(36);
  const visitorId = "ci-visitor-" + suffix;
  const sessionId = "ci-session-" + suffix;
  const pageViewId = "ci-page-" + suffix;

  const common = {
    pageViewId,
    visitorId,
    sessionId,
    path: "/ru"
  };

  const page = await post({
    event: "page_view",
    ...common,
    referrerHost: "example.test",
    utmSource: "ci-smoke",
    utmMedium: "test",
    utmCampaign: "analytics-ci",
    deviceType: "desktop",
    viewportWidth: 1440
  });
  assert(page.status === 201, "Page view was not created");

  await post({
    event: "engagement",
    ...common,
    durationMs: 42000,
    maxScrollPercent: 72
  });

  const click = await post({
    event: "click",
    ...common,
    label: "CI Trial CTA",
    targetPath: "/ru/trial",
    elementTag: "a",
    eventName: "click"
  });
  assert(click.status === 201, "Click was not created");

  const [storedPage, storedClick] = await Promise.all([
    prisma.webPageView.findUnique({ where: { id: pageViewId } }),
    prisma.webClick.findFirst({ where: { pageViewId } })
  ]);

  assert(storedPage, "Page view is missing from database");
  assert(storedPage.durationMs === 42000, "Engagement duration was not saved");
  assert(storedPage.maxScrollPercent === 72, "Scroll depth was not saved");
  assert(storedPage.utmSource === "ci-smoke", "UTM source was not saved");
  assert(storedClick?.label === "CI Trial CTA", "Click label was not saved");

  const login = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert(login.ok, "Analytics smoke admin login failed");
  const cookie = cookieFrom(login);

  const analytics = await fetch(baseUrl + "/admin/analytics?range=7", {
    headers: { Cookie: cookie }
  });
  const html = await analytics.text();

  assert(analytics.ok, "Admin analytics page did not render");
  assert(html.includes("Аналитика сайта"), "Analytics heading is missing");
  assert(html.includes("CI Trial CTA"), "Click data is missing from analytics");
  assert(html.includes("ci-smoke"), "Traffic source is missing from analytics");

  console.log("Web analytics HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
