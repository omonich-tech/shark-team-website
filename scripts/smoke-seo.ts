import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function html(path: string) {
  const response = await fetch(baseUrl + path, { redirect: "manual" });
  const body = await response.text();
  return { response, body };
}

function canonicalMarkup(body: string, expected: string) {
  return (
    body.includes('rel="canonical" href="' + expected + '"') ||
    body.includes('href="' + expected + '" rel="canonical"')
  );
}

function hrefLangMarkup(
  body: string,
  lang: string,
  expected: string
) {
  return (
    body.includes(
      'rel="alternate" hrefLang="' +
        lang +
        '" href="' +
        expected +
        '"'
    ) ||
    body.includes(
      'rel="alternate" hreflang="' +
        lang +
        '" href="' +
        expected +
        '"'
    ) ||
    body.includes(
      'href="' +
        expected +
        '" hrefLang="' +
        lang +
        '" rel="alternate"'
    )
  );
}

async function main() {
  const prisma = getPrisma();

  const [sport, branch, coach] = await Promise.all([
    prisma.sport.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.branch.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" }
    }),
    prisma.coach.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" }
    })
  ]);

  assert(sport, "SEO smoke requires an active sport");
  assert(branch, "SEO smoke requires an active branch");
  assert(coach, "SEO smoke requires an active coach");

  const siteBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const home = await html("/ru");
  assert(home.response.ok, "RU home did not render");
  assert(
    canonicalMarkup(home.body, siteBase + "/ru"),
    "RU home canonical is missing"
  );
  assert(
    hrefLangMarkup(home.body, "ru", siteBase + "/ru") &&
      hrefLangMarkup(home.body, "uz", siteBase + "/uz") &&
      hrefLangMarkup(home.body, "x-default", siteBase + "/ru"),
    "Home hreflang links are incomplete"
  );
  assert(
    home.body.includes('property="og:title"') &&
      home.body.includes('property="og:url"'),
    "Home Open Graph metadata is missing"
  );
  assert(
    home.body.includes('"@type":"SportsOrganization"'),
    "Home SportsOrganization JSON-LD is missing"
  );

  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  if (googleVerification) {
    assert(
      home.body.includes('name="google-site-verification"') &&
        home.body.includes(`content="${googleVerification}"`),
      "Google Search Console verification tag is missing"
    );
  }

  const yandexVerification = process.env.YANDEX_SITE_VERIFICATION?.trim();
  if (yandexVerification) {
    assert(
      home.body.includes('name="yandex-verification"') &&
        home.body.includes(`content="${yandexVerification}"`),
      "Yandex Webmaster verification tag is missing"
    );
  }

  const sportPath = "/ru/sports/" + sport.slug;
  const sportPage = await html(sportPath);
  assert(sportPage.response.ok, "Sport SEO page did not render");
  assert(
    canonicalMarkup(sportPage.body, siteBase + sportPath),
    "Sport canonical is missing"
  );
  assert(
    hrefLangMarkup(
      sportPage.body,
      "uz",
      siteBase + "/uz/sports/" + sport.slug
    ),
    "Sport hreflang is missing"
  );
  assert(
    sportPage.body.includes('"@type":"Service"') &&
      sportPage.body.includes('"@type":"BreadcrumbList"'),
    "Sport structured data is incomplete"
  );

  const branchPath = "/ru/branches/" + branch.slug;
  const branchPage = await html(branchPath);
  assert(branchPage.response.ok, "Branch SEO page did not render");
  assert(
    canonicalMarkup(branchPage.body, siteBase + branchPath),
    "Branch canonical is missing"
  );
  assert(
    branchPage.body.includes('"@type":"SportsActivityLocation"') &&
      branchPage.body.includes('"@type":"PostalAddress"') &&
      branchPage.body.includes('"@type":"GeoCoordinates"') &&
      branchPage.body.includes('"@type":"OpeningHoursSpecification"'),
    "Branch local structured data is incomplete"
  );
  assert(
    branchPage.body.includes("41.352103") &&
      branchPage.body.includes("69.298296"),
    "Branch coordinates are missing from structured data"
  );
  assert(
    branchPage.body.includes("Юнусабад") &&
      branchPage.body.includes("Шахристан"),
    "Branch local-search copy is incomplete"
  );

  const coachPath = "/ru/coaches/" + coach.id;
  const coachPage = await html(coachPath);
  assert(coachPage.response.ok, "Coach SEO page did not render");
  assert(
    canonicalMarkup(coachPage.body, siteBase + coachPath),
    "Coach canonical is missing"
  );
  assert(
    coachPage.body.includes('"@type":"Person"') &&
      coachPage.body.includes('"@type":"BreadcrumbList"'),
    "Coach structured data is incomplete"
  );

  for (const path of [
    "/ru/about",
    "/ru/contacts",
    "/ru/sports",
    "/ru/branches",
    "/ru/coaches",
    "/ru/schedule",
    "/ru/prices"
  ]) {
    const page = await html(path);
    assert(page.response.ok, path + " did not render");
    assert(
      page.body.includes('rel="canonical"'),
      path + " canonical is missing"
    );
    assert(
      page.body.includes('hrefLang="uz"') ||
        page.body.includes('hreflang="uz"'),
      path + " hreflang is missing"
    );
    assert(
      page.body.includes('property="og:title"'),
      path + " Open Graph title is missing"
    );
  }

  const trial = await html("/ru/trial");
  assert(trial.response.ok, "Trial page did not render");
  assert(
    trial.body.includes('name="robots"') &&
      trial.body.toLowerCase().includes("noindex"),
    "Trial page is not noindex"
  );

  const paymentReturn = await html("/ru/trial/payment-return");
  assert(paymentReturn.response.ok, "Payment return page did not render");
  assert(
    paymentReturn.body.includes('name="robots"') &&
      paymentReturn.body.toLowerCase().includes("noindex"),
    "Payment return page is not noindex"
  );

  const legacy = await html("/ru/basketball");
  assert(
    legacy.response.status === 308,
    "Legacy basketball URL is not a permanent redirect"
  );
  assert(
    legacy.response.headers.get("location") === "/ru/sports/basketball",
    "Legacy basketball redirect target is wrong"
  );

  const robots = await fetch(baseUrl + "/robots.txt");
  const robotsText = await robots.text();
  assert(robots.ok, "robots.txt did not render");
  assert(
    robotsText.includes("Disallow: /admin") &&
      robotsText.includes("Disallow: /api"),
    "robots.txt private paths are incomplete"
  );
  assert(
    !robotsText.includes("Disallow: /ru/trial") &&
      !robotsText.includes("Disallow: /uz/trial"),
    "robots.txt blocks pages that must expose noindex"
  );

  const indexNowKey = process.env.INDEXNOW_KEY?.trim();
  if (indexNowKey) {
    const keyFile = await fetch(baseUrl + "/" + indexNowKey + ".txt");
    const keyBody = await keyFile.text();
    assert(keyFile.ok, "IndexNow key file did not render");
    assert(keyBody === indexNowKey, "IndexNow key file content is wrong");
    assert(
      keyFile.headers.get("x-robots-tag")?.includes("noindex"),
      "IndexNow key file must be noindex"
    );
  }

  const unauthorizedIndexNow = await fetch(baseUrl + "/api/jobs/indexnow", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      urls: [siteBase + "/ru"]
    })
  });
  assert(
    unauthorizedIndexNow.status === 401,
    "IndexNow endpoint must reject unauthenticated requests"
  );

  const sitemap = await fetch(baseUrl + "/sitemap.xml");
  const sitemapXml = await sitemap.text();
  assert(sitemap.ok, "sitemap.xml did not render");
  for (const expected of [
    siteBase + "/ru/sports/" + sport.slug,
    siteBase + "/uz/sports/" + sport.slug,
    siteBase + "/ru/branches/" + branch.slug,
    siteBase + "/uz/branches/" + branch.slug,
    siteBase + "/ru/coaches/" + coach.id,
    siteBase + "/uz/coaches/" + coach.id
  ]) {
    assert(
      sitemapXml.includes(expected),
      "Sitemap is missing " + expected
    );
  }
  assert(
    !sitemapXml.includes("/ru/basketball") &&
      !sitemapXml.includes("/uz/basketball"),
    "Legacy basketball URLs leaked into sitemap"
  );

  console.log("SEO HTTP smoke test passed.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await getPrisma().$disconnect();
  process.exit(1);
});
