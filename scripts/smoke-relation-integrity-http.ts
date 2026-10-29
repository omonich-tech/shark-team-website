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

async function expectError(
  path: string,
  method: "PATCH" | "PUT",
  body: unknown,
  cookie: string,
  expectedError: string
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

  assert(
    response.status === 409 && payload.error === expectedError,
    `${method} ${path}: expected 409 ${expectedError}, got ${response.status} ${JSON.stringify(payload)}`
  );
}

async function main() {
  if (!username || !password) {
    throw new Error("Admin smoke credentials are not configured");
  }

  const group = await prisma.trainingGroup.findFirst({
    where: {
      status: "ACTIVE",
      branch: { status: "ACTIVE" },
      sport: { status: "ACTIVE" },
      primaryCoach: { status: "ACTIVE" }
    },
    include: {
      branch: true,
      sport: true,
      primaryCoach: true
    },
    orderBy: { createdAt: "asc" }
  });

  assert(group, "No fully active group is available for relation integrity smoke");

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert(login.ok, "Relation integrity smoke admin login failed");
  const cookie = cookieFrom(login);

  await expectError(
    `/api/admin/branches/${group.branchId}/sports`,
    "PUT",
    { sportIds: [] },
    cookie,
    "BRANCH_SPORT_IN_USE"
  );
  await expectError(
    `/api/admin/branches/${group.branchId}/coaches`,
    "PUT",
    { coachIds: [] },
    cookie,
    "BRANCH_COACH_IN_USE"
  );
  await expectError(
    `/api/admin/coaches/${group.primaryCoachId}/sports`,
    "PUT",
    { sportIds: [] },
    cookie,
    "COACH_SPORT_IN_USE"
  );
  await expectError(
    `/api/admin/coaches/${group.primaryCoachId}/branches`,
    "PUT",
    { branchIds: [] },
    cookie,
    "COACH_BRANCH_IN_USE"
  );

  await expectError(
    `/api/admin/branches/${group.branchId}`,
    "PATCH",
    {
      status: "PAUSED",
      internalName: group.branch.internalName,
      slug: group.branch.slug,
      publicNameRu: group.branch.publicNameRu,
      publicNameUz: group.branch.publicNameUz,
      addressRu: group.branch.addressRu,
      addressUz: group.branch.addressUz
    },
    cookie,
    "BRANCH_HAS_ACTIVE_GROUPS"
  );

  await expectError(
    `/api/admin/sports/${group.sportId}`,
    "PATCH",
    {
      status: "PAUSED",
      slug: group.sport.slug,
      nameRu: group.sport.nameRu,
      nameUz: group.sport.nameUz,
      ageMin: group.sport.ageMin,
      ageMax: group.sport.ageMax,
      sortOrder: group.sport.sortOrder
    },
    cookie,
    "SPORT_HAS_ACTIVE_GROUPS"
  );

  await expectError(
    `/api/admin/coaches/${group.primaryCoachId}`,
    "PATCH",
    {
      status: "PAUSED",
      firstName: group.primaryCoach.firstName
    },
    cookie,
    "COACH_HAS_ACTIVE_GROUPS"
  );

  const faqQuestion = `Relation integrity FAQ ${group.id}`;
  const faqResponse = await fetch(`${baseUrl}/api/admin/faq`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({
      status: "PUBLISHED",
      branchId: group.branchId,
      sportId: group.sportId,
      questionRu: faqQuestion,
      questionUz: faqQuestion,
      answerRu: "Scoped relation smoke answer.",
      answerUz: "Scoped relation smoke answer.",
      sortOrder: 9999
    })
  });
  const faqPayload = await faqResponse.json();
  assert(
    faqResponse.status === 201 && faqPayload.ok,
    `Scoped FAQ creation failed: ${faqResponse.status} ${JSON.stringify(faqPayload)}`
  );

  const [branchPage, sportPage] = await Promise.all([
    fetch(`${baseUrl}/ru/branches/${group.branch.slug}`),
    fetch(`${baseUrl}/ru/sports/${group.sport.slug}`)
  ]);
  const [branchHtml, sportHtml] = await Promise.all([
    branchPage.text(),
    sportPage.text()
  ]);

  assert(
    branchPage.ok && branchHtml.includes(faqQuestion),
    "Branch page did not render branch + sport FAQ"
  );
  assert(
    sportPage.ok && sportHtml.includes(faqQuestion),
    "Sport page did not render branch + sport FAQ"
  );

  const faqDelete = await fetch(
    `${baseUrl}/api/admin/faq/${faqPayload.faq.id}`,
    {
      method: "DELETE",
      headers: { Cookie: cookie }
    }
  );
  const faqDeletePayload = await faqDelete.json();
  assert(
    faqDelete.ok && faqDeletePayload.ok,
    "Scoped FAQ cleanup failed"
  );

  console.log("Relation integrity HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
