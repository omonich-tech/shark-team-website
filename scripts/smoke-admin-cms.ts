import "dotenv/config";
import { getPrisma } from "../src/lib/prisma";
import { verifyCoachPassword } from "../src/server/coach/password";

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

async function json(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
  cookie: string
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      `${method} ${path} failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

async function main() {
  if (!username || !password) {
    throw new Error("Admin smoke credentials are not configured");
  }

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  assert(login.ok, "Admin CMS login failed");
  const cookie = cookieFrom(login);

  const sportPayload = await json(
    "/api/admin/sports",
    "POST",
    {
      nameRu: "CI Волейбол",
      nameUz: "CI Voleybol",
      slug: "ci-volleyball",
      status: "ACTIVE",
      ageMin: 9,
      ageMax: 15,
      sortOrder: 77,
      shortDescriptionRu: "CI описание спорта",
      shortDescriptionUz: "CI sport tavsifi"
    },
    cookie
  );

  const branchPayload = await json(
    "/api/admin/branches",
    "POST",
    {
      internalName: "CI Branch",
      slug: "ci-branch",
      publicNameRu: "SHARK TEAM — CI Branch",
      publicNameUz: "SHARK TEAM — CI filial",
      districtRu: "CI район",
      districtUz: "CI tumani",
      addressRu: "CI адрес, Ташкент",
      addressUz: "CI manzil, Toshkent",
      landmarkRu: "CI ориентир",
      landmarkUz: "CI mo‘ljal",
      status: "DRAFT"
    },
    cookie
  );

  const coachPayload = await json(
    "/api/admin/coaches",
    "POST",
    {
      firstName: "CI",
      lastName: "Coach",
      status: "ACTIVE"
    },
    cookie
  );

  const branchId = String(branchPayload.branch.id);
  const sportId = String(sportPayload.sport.id);
  const coachId = String(coachPayload.coach.id);

  await json(
    `/api/admin/sports/${sportId}`,
    "PATCH",
    {
      status: "ACTIVE",
      slug: "ci-volleyball-updated",
      nameRu: "CI Волейбол Updated",
      nameUz: "CI Voleybol Updated",
      ageMin: 8,
      ageMax: 16,
      sortOrder: 76,
      shortDescriptionRu: "CI спорт управляется из CMS",
      shortDescriptionUz: "CI sport CMS orqali boshqariladi"
    },
    cookie
  );

  await json(
    `/api/admin/coaches/${coachId}/account`,
    "PATCH",
    {
      username: "ci-coach-admin",
      password: "ci-coach-password-123",
      isActive: true
    },
    cookie
  );

  const coachAccount = await prisma.coachAccount.findUnique({
    where: { coachId }
  });

  assert(coachAccount, "Coach account was not created from Admin");
  assert(
    coachAccount.passwordHash !== "ci-coach-password-123",
    "Coach password must never be stored in plaintext"
  );
  assert(
    await verifyCoachPassword(
      "ci-coach-password-123",
      coachAccount.passwordSalt,
      coachAccount.passwordHash
    ),
    "Coach account password hash is invalid"
  );

  await json(
    `/api/admin/branches/${branchId}`,
    "PATCH",
    {
      status: "ACTIVE",
      internalName: "CI Branch",
      slug: "ci-branch",
      publicNameRu: "SHARK TEAM — CI Branch Updated",
      publicNameUz: "SHARK TEAM — CI filial yangilangan",
      districtRu: "CI район",
      districtUz: "CI tumani",
      addressRu: "CI адрес, Ташкент",
      addressUz: "CI manzil, Toshkent",
      landmarkRu: "CI ориентир",
      landmarkUz: "CI mo‘ljal"
    },
    cookie
  );

  await json(
    `/api/admin/branches/${branchId}/sports`,
    "PUT",
    { sportIds: [sportId] },
    cookie
  );

  await json(
    `/api/admin/coaches/${coachId}`,
    "PATCH",
    {
      status: "ACTIVE",
      firstName: "CI",
      lastName: "Coach Updated",
      experienceYears: 3
    },
    cookie
  );

  const groupPayload = await json(
    "/api/admin/groups",
    "POST",
    {
      branchId,
      sportId,
      primaryCoachId: coachId,
      internalName: "CI Volleyball 10-12",
      ageMin: 10,
      ageMax: 12,
      capacityRegular: 18,
      capacityTrial: null,
      status: "DRAFT",
      enrollmentStatus: "PAUSED",
      schedule: [
        { weekday: "MONDAY", start: "10:00", end: "11:00" },
        { weekday: "WEDNESDAY", start: "10:00", end: "11:00" }
      ]
    },
    cookie
  );

  const groupId = String(groupPayload.group.id);

  await json(
    `/api/admin/groups/${groupId}`,
    "PATCH",
    {
      status: "ACTIVE",
      enrollmentStatus: "OPEN",
      ageMin: 10,
      ageMax: 12,
      capacityRegular: 18,
      capacityTrial: 1,
      schedule: [
        { weekday: "MONDAY", start: "10:00", end: "11:00" },
        { weekday: "WEDNESDAY", start: "10:00", end: "11:00" }
      ]
    },
    cookie
  );

  const pricePayload = await json(
    "/api/admin/prices",
    "POST",
    {
      productType: "TRIAL",
      amount: 123456,
      branchId,
      sportId,
      groupId
    },
    cookie
  );

  assert(
    pricePayload.price.amount === 123456,
    "CMS price version was not created"
  );

  await json(
    "/api/admin/faq",
    "POST",
    {
      status: "PUBLISHED",
      branchId: "BR-SCHOOL-117-01",
      sportId: "SP-BASKETBALL-01",
      questionRu: "CI вопрос?",
      questionUz: "CI savol?",
      answerRu: "CI ответ из CMS.",
      answerUz: "CI CMS javobi.",
      sortOrder: 999
    },
    cookie
  );

  await json(
    "/api/admin/content/home",
    "PATCH",
    {
      status: "PUBLISHED",
      heroEyebrowRu: "CI SHARK TEAM",
      heroEyebrowUz: "CI SHARK TEAM",
      heroTitleRu: "CI CMS Hero",
      heroTitleUz: "CI CMS Hero UZ",
      heroLeadRu: "CI lead from admin CMS.",
      heroLeadUz: "CI admin CMS matni.",
      seoTitleRu: "CI SEO RU",
      seoTitleUz: "CI SEO UZ",
      seoDescriptionRu: "CI SEO description RU",
      seoDescriptionUz: "CI SEO description UZ"
    },
    cookie
  );

  const safeForm = new FormData();
  safeForm.set(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "ci-safe.png", {
      type: "image/png"
    })
  );
  safeForm.set("targetType", "BRANCH");
  safeForm.set("targetId", "BR-SCHOOL-117-01");
  safeForm.set("category", "MAIN");
  safeForm.set("containsMinors", "false");
  safeForm.set("consentStatus", "NOT_REQUIRED");
  safeForm.set("isPrimary", "true");
  safeForm.set("altRu", "CI Safe Media");
  safeForm.set("altUz", "CI Safe Media UZ");

  const safeUpload = await fetch(
    `${baseUrl}/api/admin/media/upload`,
    {
      method: "POST",
      headers: { Cookie: cookie },
      body: safeForm
    }
  );
  const safePayload = await safeUpload.json();

  assert(
    safeUpload.status === 201 && safePayload.ok,
    "Safe CMS media upload failed"
  );

  const pendingForm = new FormData();
  pendingForm.set(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "ci-minor.png", {
      type: "image/png"
    })
  );
  pendingForm.set("targetType", "BRANCH");
  pendingForm.set("targetId", "BR-SCHOOL-117-01");
  pendingForm.set("category", "TRAINING");
  pendingForm.set("containsMinors", "true");
  pendingForm.set("consentStatus", "PENDING");
  pendingForm.set("altRu", "CI Pending Minor");
  pendingForm.set("altUz", "CI Pending Minor UZ");

  const pendingUpload = await fetch(
    `${baseUrl}/api/admin/media/upload`,
    {
      method: "POST",
      headers: { Cookie: cookie },
      body: pendingForm
    }
  );
  const pendingPayload = await pendingUpload.json();

  assert(
    pendingUpload.status === 201 && pendingPayload.ok,
    "Pending-minor media upload failed"
  );
  assert(
    pendingPayload.asset.consentStatus === "PENDING",
    "Minor media must remain pending without approved consent"
  );

  const [createdBranch, createdGroup, sessions, auditCount] =
    await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId } }),
      prisma.trainingGroup.findUnique({ where: { id: groupId } }),
      prisma.trainingSession.count({ where: { groupId } }),
      prisma.auditLog.count()
    ]);

  assert(createdBranch?.status === "ACTIVE", "Created branch was not activated");
  const branchSport = await prisma.branchSport.findUnique({
    where: { branchId_sportId: { branchId, sportId } }
  });
  assert(
    branchSport?.status === "ACTIVE",
    "Branch sport relation was not activated from Admin"
  );
  assert(createdGroup?.status === "ACTIVE", "Created group was not activated");
  assert(sessions > 0, "Created active group did not generate Sessions");
  assert(auditCount >= 8, "Admin mutations were not audited");

  const branchList = await fetch(`${baseUrl}/admin/branches`, {
    headers: { Cookie: cookie }
  });
  const branchListHtml = await branchList.text();
  assert(
    branchList.ok && branchListHtml.includes("CI Branch Updated"),
    "New branch is missing from admin list"
  );

  const publicSports = await fetch(`${baseUrl}/ru/sports`);
  const publicSportsHtml = await publicSports.text();
  assert(
    publicSports.ok &&
      publicSportsHtml.includes("CI Волейбол Updated") &&
      publicSportsHtml.includes("CI спорт управляется из CMS"),
    "CMS-created active sport is missing from public sports catalog"
  );

  const publicSport = await fetch(
    `${baseUrl}/ru/sports/ci-volleyball-updated`
  );
  const publicSportHtml = await publicSport.text();
  assert(
    publicSport.ok &&
      publicSportHtml.includes("CI Волейбол Updated") &&
      publicSportHtml.includes("CI спорт управляется из CMS"),
    "Dynamic CMS-created sport detail page did not render"
  );

  const publicCatalog = await fetch(`${baseUrl}/ru/branches`);
  const catalogHtml = await publicCatalog.text();
  assert(
    publicCatalog.ok && catalogHtml.includes("CI Branch Updated"),
    "New active branch is missing from public branch catalog"
  );

  const publicBranch = await fetch(
    `${baseUrl}/ru/branches/ci-branch`
  );
  const publicBranchHtml = await publicBranch.text();
  assert(
    publicBranch.ok &&
      publicBranchHtml.includes("CI Branch Updated") &&
      publicBranchHtml.includes("10–12 лет"),
    "Dynamic public branch page did not render created branch/group"
  );

  const home = await fetch(`${baseUrl}/ru`);
  const homeHtml = await home.text();

  assert(homeHtml.includes("CI CMS Hero"), "Published CMS hero is not public");
  assert(homeHtml.includes("CI вопрос?"), "Published FAQ is not public");
  assert(homeHtml.includes("CI Safe Media"), "Consent-safe media is not public");
  assert(
    !homeHtml.includes("CI Pending Minor"),
    "Pending minor media leaked to public page"
  );

  console.log("Admin CMS HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
