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

async function json(path: string, method: "POST", body: unknown, cookie: string) {
  const response = await fetch(baseUrl + path, {
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
      method + " " + path + " failed: " + response.status + " " + JSON.stringify(payload)
    );
  }
  return payload;
}

async function main() {
  assert(username && password, "Admin smoke credentials are missing");

  const login = await fetch(baseUrl + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  assert(login.ok, "Group operations admin login failed");
  const cookie = cookieFrom(login);

  const source = await prisma.studentEnrollment.findFirst({
    where: {
      child: { name: "Coach Trial Child" },
      status: "ACTIVE"
    },
    include: {
      child: true,
      group: true
    },
    orderBy: { createdAt: "asc" }
  });

  assert(source, "Group operations source student not found");

  const groupId = "CI-GROUP-OPS-TARGET";
  await prisma.trainingGroup.upsert({
    where: { id: groupId },
    update: {
      status: "ACTIVE",
      enrollmentStatus: "OPEN",
      capacityRegular: 20
    },
    create: {
      id: groupId,
      branchId: source.group.branchId,
      sportId: source.group.sportId,
      primaryCoachId: source.group.primaryCoachId,
      internalName: "CI Group Operations",
      status: "ACTIVE",
      enrollmentStatus: "OPEN",
      ageMin: source.group.ageMin,
      ageMax: source.group.ageMax,
      capacityRegular: 20,
      capacityTrial: 2
    }
  });

  await prisma.price.upsert({
    where: { id: "CI-GROUP-OPS-PRICE" },
    update: {
      amount: 555000,
      status: "ACTIVE",
      groupId
    },
    create: {
      id: "CI-GROUP-OPS-PRICE",
      productType: "SUBSCRIPTION",
      amount: 555000,
      currency: "UZS",
      groupId,
      branchId: source.group.branchId,
      sportId: source.group.sportId,
      status: "ACTIVE"
    }
  });

  const existing = await prisma.studentEnrollment.findFirst({
    where: {
      childId: source.childId,
      groupId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });

  if (existing) {
    await prisma.studentEnrollment.update({
      where: { id: existing.id },
      data: {
        status: "ENDED",
        subscriptionStatus: "ENDED",
        endDate: new Date()
      }
    });
  }

  const added = await json(
    "/api/admin/groups/" + groupId + "/members",
    "POST",
    { childId: source.childId },
    cookie
  );

  const enrollmentId = String(added.enrollment.id);
  const created = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { payments: true }
  });

  assert(created?.status === "ACTIVE", "Group member was not activated");
  assert(created.groupId === groupId, "Group member was created in wrong group");
  assert(
    created.subscriptionStatus === "PAYMENT_DUE",
    "New additional enrollment must require payment"
  );
  assert(
    created.payments.some((payment) => payment.status === "PENDING"),
    "Pending subscription payment was not created"
  );

  const page = await fetch(baseUrl + "/admin/groups/" + groupId, {
    headers: { Cookie: cookie }
  });
  const html = await page.text();

  assert(page.ok, "Group operations page did not render");
  assert(html.includes("GROUP OPERATIONS"), "Group operations heading missing");
  assert(html.includes("Свободные места"), "Free places metric missing");
  assert(html.includes("Проблемы оплаты"), "Payment attention metric missing");
  assert(html.includes("Риск по посещаемости"), "Attendance risk metric missing");
  assert(html.includes("Нужна оценка"), "Assessment metric missing");
  assert(html.includes("Добавить или перевести ученика"), "Member manager missing");
  assert(html.includes("Ближайшие тренировки"), "Upcoming sessions block missing");
  assert(html.includes(source.child.name), "Added student missing from group roster");

  await json(
    "/api/admin/enrollments/" + enrollmentId + "/subscription",
    "POST",
    {
      action: "end",
      reason: "CI group operations cleanup"
    },
    cookie
  );

  const ended = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId }
  });
  assert(ended?.status === "ENDED", "Group member was not removed from active roster");

  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "ADD_STUDENT_TO_GROUP",
      entityType: "StudentEnrollment",
      entityId: enrollmentId
    }
  });
  assert(audit, "Group member add audit log is missing");

  console.log("Group operations HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
