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

async function json(path: string, method: "POST" | "PATCH", body: unknown, cookie: string) {
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
    throw new Error(method + " " + path + " failed: " + response.status + " " + JSON.stringify(payload));
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
  assert(login.ok, "Student management admin login failed");
  const cookie = cookieFrom(login);

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      child: { name: "Coach Trial Child" },
      status: "ACTIVE",
      payments: { some: { status: "PAID" } }
    },
    include: {
      child: { include: { parent: true } },
      group: true,
      payments: { orderBy: { sequence: "desc" } }
    }
  });

  assert(enrollment, "Student management smoke enrollment not found");

  const originalGroupId = enrollment.groupId;
  const originalChildName = enrollment.child.name;
  const originalAge = enrollment.child.ageAtRegistration;
  const originalDate = enrollment.child.dateOfBirth;
  const originalParentName = enrollment.child.parent.name;
  const originalPhone = enrollment.child.parent.phone;
  const originalLocale = enrollment.child.parent.locale;

  const targetGroupId = "CI-STUDENT-MGMT-TARGET";
  await prisma.trainingGroup.upsert({
    where: { id: targetGroupId },
    update: {
      status: "ACTIVE",
      enrollmentStatus: "OPEN",
      capacityRegular: 25
    },
    create: {
      id: targetGroupId,
      branchId: enrollment.group.branchId,
      sportId: enrollment.group.sportId,
      primaryCoachId: enrollment.group.primaryCoachId,
      internalName: "CI Student Management Target",
      status: "ACTIVE",
      enrollmentStatus: "OPEN",
      ageMin: enrollment.group.ageMin,
      ageMax: enrollment.group.ageMax,
      capacityRegular: 25,
      capacityTrial: 1
    }
  });

  await prisma.price.upsert({
    where: { id: "CI-STUDENT-MGMT-PRICE" },
    update: {
      amount: 777000,
      status: "ACTIVE",
      groupId: targetGroupId
    },
    create: {
      id: "CI-STUDENT-MGMT-PRICE",
      productType: "SUBSCRIPTION",
      amount: 777000,
      currency: "UZS",
      groupId: targetGroupId,
      branchId: enrollment.group.branchId,
      sportId: enrollment.group.sportId,
      status: "ACTIVE"
    }
  });

  await json(
    "/api/admin/children/" + enrollment.childId,
    "PATCH",
    {
      childName: originalChildName + " Managed",
      ageAtRegistration: originalAge,
      dateOfBirth: originalDate ? originalDate.toISOString().slice(0, 10) : "",
      parentName: originalParentName,
      parentPhone: originalPhone,
      locale: originalLocale
    },
    cookie
  );

  let updatedChild = await prisma.child.findUnique({
    where: { id: enrollment.childId }
  });
  assert(
    updatedChild?.name === originalChildName + " Managed",
    "Student profile update was not persisted"
  );

  await json(
    "/api/admin/children/" + enrollment.childId + "/notes",
    "POST",
    { note: "CI private student management note" },
    cookie
  );

  const note = await prisma.studentAdminNote.findFirst({
    where: {
      childId: enrollment.childId,
      note: "CI private student management note"
    }
  });
  assert(note, "Student admin note was not saved");

  await json(
    "/api/admin/enrollments/" + enrollment.id + "/transfer",
    "POST",
    {
      targetGroupId,
      reason: "CI transfer verification"
    },
    cookie
  );

  let updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });
  assert(
    updatedEnrollment?.groupId === targetGroupId,
    "Student was not transferred to target group"
  );

  await json(
    "/api/admin/enrollments/" + enrollment.id + "/transfer",
    "POST",
    {
      targetGroupId: originalGroupId,
      reason: "CI transfer rollback"
    },
    cookie
  );

  updatedEnrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollment.id }
  });
  assert(
    updatedEnrollment?.groupId === originalGroupId,
    "Student was not transferred back to original group"
  );

  const beforePayments = await prisma.subscriptionPayment.count({
    where: { enrollmentId: enrollment.id, status: "PAID" }
  });

  await json(
    "/api/admin/enrollments/" + enrollment.id + "/manual-payment",
    "POST",
    {
      amountUzs: 333000,
      paidAt: "2026-11-01"
    },
    cookie
  );

  const afterPayments = await prisma.subscriptionPayment.count({
    where: { enrollmentId: enrollment.id, status: "PAID" }
  });
  assert(
    afterPayments === beforePayments + 1,
    "Manual subscription payment was not recorded"
  );

  await json(
    "/api/admin/children/" + enrollment.childId,
    "PATCH",
    {
      childName: originalChildName,
      ageAtRegistration: originalAge,
      dateOfBirth: originalDate ? originalDate.toISOString().slice(0, 10) : "",
      parentName: originalParentName,
      parentPhone: originalPhone,
      locale: originalLocale
    },
    cookie
  );

  updatedChild = await prisma.child.findUnique({
    where: { id: enrollment.childId }
  });
  assert(updatedChild?.name === originalChildName, "Student profile rollback failed");

  const auditActions = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "Child", entityId: enrollment.childId },
        { entityType: "StudentEnrollment", entityId: enrollment.id }
      ],
      action: {
        in: [
          "UPDATE_STUDENT_PROFILE",
          "ADD_STUDENT_NOTE",
          "TRANSFER_STUDENT_GROUP",
          "RECORD_MANUAL_SUBSCRIPTION_PAYMENT"
        ]
      }
    },
    select: { action: true }
  });

  const actions = new Set(auditActions.map((item) => item.action));
  assert(actions.has("UPDATE_STUDENT_PROFILE"), "Profile update audit missing");
  assert(actions.has("ADD_STUDENT_NOTE"), "Student note audit missing");
  assert(actions.has("TRANSFER_STUDENT_GROUP"), "Transfer audit missing");
  assert(actions.has("RECORD_MANUAL_SUBSCRIPTION_PAYMENT"), "Manual payment audit missing");

  const page = await fetch(baseUrl + "/admin/children/" + enrollment.childId, {
    headers: { Cookie: cookie }
  });
  const html = await page.text();
  assert(page.ok && html.includes("STUDENT 360"), "Student management page did not render");
  assert(html.includes("Внутренние заметки"), "Student notes UI is missing");
  assert(html.includes("Перевод между группами"), "Student transfer UI is missing");
  assert(html.includes("Ручная оплата абонемента"), "Student manual payment UI is missing");

  console.log("Student management HTTP smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
