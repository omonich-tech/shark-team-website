import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { getBranchPublicData } from "../src/server/public-data/branch";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Admin login did not return a cookie");
  return raw.split(";")[0];
}

async function json(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown> | null,
  cookie: string
) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      path +
        " failed: " +
        response.status +
        " " +
        JSON.stringify(payload)
    );
  }

  return payload;
}

async function page(path: string) {
  const response = await fetch(baseUrl + path);
  const html = await response.text();
  assert(response.ok, path + " did not render");
  return html;
}

async function pageEventually(
  path: string,
  expected: string,
  attempts = 3
) {
  let html = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(baseUrl + path, {
      headers: { "Cache-Control": "no-cache" }
    });
    html = await response.text();
    assert(response.ok, path + " did not render");

    if (html.includes(expected)) return html;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  return html;
}

async function main() {
  assert(username && password, "Admin credentials are missing");
  const prisma = getPrisma();

  const login = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert(login.ok, "Content CMS smoke admin login failed");
  const cookie = cookieFrom(login);

  const suffix = Date.now().toString(36);
  const globalQuestion = "CI GLOBAL FAQ " + suffix;
  const sportQuestion = "CI SPORT FAQ " + suffix;
  const branchQuestion = "CI BRANCH FAQ " + suffix;

  await json(
    "/api/admin/faq",
    "POST",
    {
      status: "PUBLISHED",
      branchId: null,
      sportId: null,
      questionRu: globalQuestion,
      questionUz: globalQuestion + " UZ",
      answerRu: "Global CMS answer " + suffix,
      answerUz: "Global CMS answer UZ " + suffix,
      sortOrder: -900
    },
    cookie
  );

  await json(
    "/api/admin/faq",
    "POST",
    {
      status: "PUBLISHED",
      branchId: null,
      sportId: "SP-BASKETBALL-01",
      questionRu: sportQuestion,
      questionUz: sportQuestion + " UZ",
      answerRu: "Sport CMS answer " + suffix,
      answerUz: "Sport CMS answer UZ " + suffix,
      sortOrder: -900
    },
    cookie
  );

  await json(
    "/api/admin/faq",
    "POST",
    {
      status: "PUBLISHED",
      branchId: "BR-SCHOOL-117-01",
      sportId: null,
      questionRu: branchQuestion,
      questionUz: branchQuestion + " UZ",
      answerRu: "Branch CMS answer " + suffix,
      answerUz: "Branch CMS answer UZ " + suffix,
      sortOrder: -900
    },
    cookie
  );

  await json(
    "/api/admin/content/home",
    "PATCH",
    {
      status: "PUBLISHED",
      heroEyebrowRu: "CI HOME EYEBROW",
      heroEyebrowUz: "CI HOME EYEBROW UZ",
      heroTitleRu: "CI HOME HERO",
      heroTitleUz: "CI HOME HERO UZ",
      heroLeadRu: "CI HOME LEAD",
      heroLeadUz: "CI HOME LEAD UZ",
      seoTitleRu: "CI HOME SEO",
      seoTitleUz: "CI HOME SEO UZ",
      seoDescriptionRu: "CI HOME SEO DESCRIPTION",
      seoDescriptionUz: "CI HOME SEO DESCRIPTION UZ"
    },
    cookie
  );

  await json(
    "/api/admin/content/home",
    "PATCH",
    {
      sectionsJson: {
        sportsTitleRu: "CI HOME SPORTS TITLE",
        sportsTitleUz: "CI HOME SPORTS TITLE UZ",
        whyTitleRu: "CI HOME WHY TITLE",
        whyTitleUz: "CI HOME WHY TITLE UZ",
        benefit1TitleRu: "CI HOME BENEFIT",
        benefit1TitleUz: "CI HOME BENEFIT UZ",
        benefit1BodyRu: "CI HOME BENEFIT BODY",
        benefit1BodyUz: "CI HOME BENEFIT BODY UZ",
        trial1TitleRu: "CI HOME TRIAL STEP",
        trial1TitleUz: "CI HOME TRIAL STEP UZ",
        trial1BodyRu: "CI HOME TRIAL BODY",
        trial1BodyUz: "CI HOME TRIAL BODY UZ",
        faqTitleRu: "CI HOME FAQ TITLE",
        faqTitleUz: "CI HOME FAQ TITLE UZ",
        ctaTitleRu: "CI HOME CTA TITLE",
        ctaTitleUz: "CI HOME CTA TITLE UZ",
        ctaLeadRu: "CI HOME CTA LEAD",
        ctaLeadUz: "CI HOME CTA LEAD UZ"
      }
    },
    cookie
  );

  await json(
    "/api/admin/content/about",
    "PATCH",
    {
      status: "PUBLISHED",
      heroEyebrowRu: "CI ABOUT EYEBROW",
      heroEyebrowUz: "CI ABOUT EYEBROW UZ",
      heroTitleRu: "CI ABOUT HERO",
      heroTitleUz: "CI ABOUT HERO UZ",
      heroLeadRu: "CI ABOUT LEAD",
      heroLeadUz: "CI ABOUT LEAD UZ",
      bodyRu: "CI ABOUT BODY",
      bodyUz: "CI ABOUT BODY UZ",
      seoTitleRu: "CI ABOUT SEO",
      seoTitleUz: "CI ABOUT SEO UZ",
      seoDescriptionRu: "CI ABOUT SEO DESCRIPTION",
      seoDescriptionUz: "CI ABOUT SEO DESCRIPTION UZ"
    },
    cookie
  );

  await json(
    "/api/admin/content/about",
    "PATCH",
    {
      sectionsJson: {
        storyTitleRu: "CI ABOUT STORY TITLE",
        storyTitleUz: "CI ABOUT STORY TITLE UZ",
        principlesTitleRu: "CI ABOUT PRINCIPLES TITLE",
        principlesTitleUz: "CI ABOUT PRINCIPLES TITLE UZ",
        principle1TitleRu: "CI ABOUT PRINCIPLE",
        principle1TitleUz: "CI ABOUT PRINCIPLE UZ",
        principle1BodyRu: "CI ABOUT PRINCIPLE BODY",
        principle1BodyUz: "CI ABOUT PRINCIPLE BODY UZ",
        ctaTitleRu: "CI ABOUT CTA TITLE",
        ctaTitleUz: "CI ABOUT CTA TITLE UZ",
        ctaLeadRu: "CI ABOUT CTA LEAD",
        ctaLeadUz: "CI ABOUT CTA LEAD UZ"
      }
    },
    cookie
  );

  await json(
    "/api/admin/content/contacts",
    "PATCH",
    {
      status: "PUBLISHED",
      heroEyebrowRu: "CI CONTACT EYEBROW",
      heroEyebrowUz: "CI CONTACT EYEBROW UZ",
      heroTitleRu: "CI CONTACT HERO",
      heroTitleUz: "CI CONTACT HERO UZ",
      heroLeadRu: "CI CONTACT LEAD",
      heroLeadUz: "CI CONTACT LEAD UZ",
      bodyRu: "CI CONTACT BODY",
      bodyUz: "CI CONTACT BODY UZ",
      contactHoursRu: "CI CONTACT HOURS",
      contactHoursUz: "CI CONTACT HOURS UZ",
      seoTitleRu: "CI CONTACT SEO",
      seoTitleUz: "CI CONTACT SEO UZ",
      seoDescriptionRu: "CI CONTACT SEO DESCRIPTION",
      seoDescriptionUz: "CI CONTACT SEO DESCRIPTION UZ"
    },
    cookie
  );

  await json(
    "/api/admin/content/contacts",
    "PATCH",
    {
      sectionsJson: {
        channelsTitleRu: "CI CONTACT CHANNELS TITLE",
        channelsTitleUz: "CI CONTACT CHANNELS TITLE UZ",
        branchesTitleRu: "CI CONTACT BRANCHES TITLE",
        branchesTitleUz: "CI CONTACT BRANCHES TITLE UZ",
        ctaTitleRu: "CI CONTACT CTA TITLE",
        ctaTitleUz: "CI CONTACT CTA TITLE UZ",
        ctaLeadRu: "CI CONTACT CTA LEAD",
        ctaLeadUz: "CI CONTACT CTA LEAD UZ"
      }
    },
    cookie
  );

  const home = await page("/ru");
  assert(home.includes("CI HOME HERO"), "Home hero CMS content is missing");
  assert(
    home.includes("CI HOME SPORTS TITLE") &&
      home.includes("CI HOME BENEFIT") &&
      home.includes("CI HOME TRIAL STEP") &&
      home.includes("CI HOME CTA TITLE"),
    "Home structured sections are missing"
  );
  assert(home.includes(globalQuestion), "Global FAQ is missing from home");
  assert(!home.includes(sportQuestion), "Sport FAQ leaked into home");
  assert(!home.includes(branchQuestion), "Branch FAQ leaked into home");
  assert(home.includes("CI HOME SEO"), "Home SEO title is missing");
  assert(
    home.includes("CI HOME SEO DESCRIPTION"),
    "Home SEO description is missing"
  );

  const sport = await page("/ru/sports/basketball");
  assert(sport.includes(sportQuestion), "Sport FAQ is missing from sport page");
  assert(!sport.includes(branchQuestion), "Branch FAQ leaked into sport page");

  const storedBranchFaq = await prisma.faqItem.findFirst({
    where: { questionRu: branchQuestion }
  });
  assert(storedBranchFaq, "Branch FAQ was not stored in database");
  assert(
    storedBranchFaq.branchId === "BR-SCHOOL-117-01" &&
      storedBranchFaq.sportId === null &&
      storedBranchFaq.status === "PUBLISHED",
    "Branch FAQ scope was stored incorrectly"
  );

  const directBranchData = await getBranchPublicData("school-117");
  assert(directBranchData, "Seed branch public data could not be loaded");
  assert(
    directBranchData.faq.some(
      (item) => item.question.ru === branchQuestion
    ),
    "Branch FAQ is missing from getBranchPublicData"
  );

  const branch = await pageEventually(
    "/ru/branches/school-117",
    branchQuestion
  );
  assert(
    branch.includes(branchQuestion),
    "Branch FAQ is missing from branch page"
  );
  assert(!branch.includes(sportQuestion), "Sport FAQ leaked into branch page");

  const about = await page("/ru/about");
  assert(
    about.includes("CI ABOUT HERO") &&
      about.includes("CI ABOUT STORY TITLE") &&
      about.includes("CI ABOUT PRINCIPLE") &&
      about.includes("CI ABOUT CTA TITLE") &&
      about.includes("CI ABOUT SEO"),
    "About CMS content or SEO is missing"
  );

  const contacts = await page("/ru/contacts");
  assert(
    contacts.includes("CI CONTACT HERO") &&
      contacts.includes("CI CONTACT CHANNELS TITLE") &&
      contacts.includes("CI CONTACT BRANCHES TITLE") &&
      contacts.includes("CI CONTACT CTA TITLE") &&
      contacts.includes("CI CONTACT SEO"),
    "Contacts CMS content or SEO is missing"
  );

  const adminFaq = await fetch(
    baseUrl + "/admin/faq?sportId=SP-BASKETBALL-01",
    { headers: { Cookie: cookie } }
  );
  const adminFaqHtml = await adminFaq.text();
  assert(
    adminFaq.ok &&
      adminFaqHtml.includes("Спорт: Баскетбол") &&
      adminFaqHtml.includes(sportQuestion),
    "Scoped FAQ admin view did not render"
  );

  console.log("Content CMS HTTP smoke test passed.");
}

main()
  .then(async () => {
    await getPrisma().$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await getPrisma().$disconnect();
    process.exit(1);
  });
