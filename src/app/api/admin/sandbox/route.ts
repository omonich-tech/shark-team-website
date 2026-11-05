import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { getPrisma } from "@/lib/prisma";
import { hashCoachPassword } from "@/server/coach/password";
import { writeAdminAudit } from "@/server/admin/audit";

export const dynamic = "force-dynamic";
const ID = {
  branch: "BR-SANDBOX", coach: "CO-SANDBOX", group: "GR-SANDBOX",
  liveSession: "SESSION-SANDBOX-LIVE", nextSession: "SESSION-SANDBOX-NEXT",
  parents: ["PARENT-SANDBOX-1", "PARENT-SANDBOX-2", "PARENT-SANDBOX-3"],
  children: ["CHILD-SANDBOX-1", "CHILD-SANDBOX-2", "CHILD-SANDBOX-3"],
  lead: "LEAD-SANDBOX", booking: "BOOKING-SANDBOX",
  username: "shark_sandbox_coach"
} as const;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  if (!(await getAdminSession())) return response({ ok: false, error: "UNAUTHORIZED" }, 401);
  const prisma = getPrisma();
  const [branch, coach, group, account, sessions] = await Promise.all([
    prisma.branch.findUnique({ where: { id: ID.branch } }),
    prisma.coach.findUnique({ where: { id: ID.coach } }),
    prisma.trainingGroup.findUnique({ where: { id: ID.group } }),
    prisma.coachAccount.findUnique({ where: { coachId: ID.coach }, select: { username: true, isActive: true } }),
    prisma.trainingSession.findMany({ where: { groupId: ID.group }, select: { id: true, startsAt: true, status: true }, orderBy: { startsAt: "asc" } })
  ]);
  return response({ ok: true, exists: Boolean(branch && coach && group), branchId: branch?.id,
    coachId: coach?.id, groupId: group?.id, username: account?.username ?? null,
    enabled: account?.isActive ?? false, sessions });
}

export async function POST() {
  const admin = await getAdminSession();
  if (!admin) return response({ ok: false, error: "UNAUTHORIZED" }, 401);
  const prisma = getPrisma();
  const existing = await prisma.coachAccount.findUnique({ where: { username: ID.username } });
  if (existing && existing.coachId !== ID.coach) {
    return response({ ok: false, error: "SANDBOX_USERNAME_CONFLICT" }, 409);
  }
  const sport = await prisma.sport.findFirst({
    where: { status: "ACTIVE", slug: "basketball" },
    select: { id: true }
  }) ?? await prisma.sport.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!sport) return response({ ok: false, error: "NO_ACTIVE_SPORT" }, 409);

  const password = "Shark-" + randomBytes(12).toString("base64url");
  const credentials = await hashCoachPassword(password);
  const now = Date.now();
  const liveStarts = new Date(now - 15 * 60_000);
  const nextStarts = new Date(now + 24 * 60 * 60_000);
  const seed = await prisma.$transaction(async tx => {
    const branch = await tx.branch.upsert({
      where: { id: ID.branch },
      create: { id: ID.branch, slug: "ghost-sandbox-internal", status: "DRAFT",
        internalName: "[TEST] Призрачный филиал", publicNameRu: "[ТЕСТ] Призрачный филиал",
        publicNameUz: "[TEST] Virtual filial", addressRu: "Виртуальный адрес. Не посещать.",
        addressUz: "Virtual manzil. Tashrif buyurmang." },
      update: { status: "DRAFT" }
    });
    const coach = await tx.coach.upsert({
      where: { id: ID.coach },
      create: { id: ID.coach, status: "DRAFT", firstName: "Тестовый", lastName: "Тренер",
        publicBioRu: "[SANDBOX] Искусственная учётная запись. Не публиковать." },
      update: { status: "DRAFT" }
    });
    await tx.coachBranch.upsert({ where: { coachId_branchId: { coachId: coach.id, branchId: branch.id } },
      create: { coachId: coach.id, branchId: branch.id, status: "ACTIVE" },
      update: { status: "ACTIVE" } });
    await tx.coachSport.upsert({ where: { coachId_sportId: { coachId: coach.id, sportId: sport.id } },
      create: { coachId: coach.id, sportId: sport.id, status: "ACTIVE" },
      update: { status: "ACTIVE" } });
    await tx.branchSport.upsert({ where: { branchId_sportId: { branchId: branch.id, sportId: sport.id } },
      create: { branchId: branch.id, sportId: sport.id, status: "ACTIVE" },
      update: { status: "ACTIVE" } });
    await tx.coachAccount.upsert({
      where: { coachId: coach.id },
      create: { coachId: coach.id, username: ID.username, passwordSalt: credentials.salt,
        passwordHash: credentials.hash, isActive: true },
      update: { username: ID.username, passwordSalt: credentials.salt,
        passwordHash: credentials.hash, isActive: true }
    });
    const group = await tx.trainingGroup.upsert({
      where: { id: ID.group },
      create: { id: ID.group, branchId: branch.id, sportId: sport.id, primaryCoachId: coach.id,
        internalName: "[TEST] Баскетбол · 9–12", status: "DRAFT", enrollmentStatus: "PAUSED",
        ageMin: 9, ageMax: 12, capacityRegular: 20, capacityTrial: 2,
        notesInternal: "SANDBOX. Исключить из реальной деятельности." },
      update: { status: "DRAFT", enrollmentStatus: "PAUSED" }
    });
    // Reset only known synthetic sessions. Leave real sessions and all real people untouched.
    await tx.attendance.deleteMany({ where: { sessionId: { in: [ID.liveSession, ID.nextSession] } } });
    await tx.trialAssessment.deleteMany({ where: { trialBookingId: ID.booking } });
    await tx.trainingSession.upsert({
      where: { id: ID.liveSession },
      create: { id: ID.liveSession, groupId: group.id, coachId: coach.id, startsAt: liveStarts,
        endsAt: new Date(liveStarts.getTime() + 60 * 60_000), regularCapacity: 20,
        trialCapacity: 2, trialBookingEnabled: false, status: "SCHEDULED" },
      update: { startsAt: liveStarts, endsAt: new Date(liveStarts.getTime() + 60 * 60_000),
        status: "SCHEDULED", completedAt: null }
    });
    await tx.trainingSession.upsert({
      where: { id: ID.nextSession },
      create: { id: ID.nextSession, groupId: group.id, coachId: coach.id, startsAt: nextStarts,
        endsAt: new Date(nextStarts.getTime() + 60 * 60_000), regularCapacity: 20,
        trialCapacity: 2, trialBookingEnabled: false, status: "SCHEDULED" },
      update: { startsAt: nextStarts, endsAt: new Date(nextStarts.getTime() + 60 * 60_000),
        status: "SCHEDULED", completedAt: null }
    });
    for (let index = 0; index < 3; index++) {
      await tx.parent.upsert({
        where: { id: ID.parents[index] },
        create: { id: ID.parents[index], name: "Тестовый родитель " + (index + 1),
          phone: "+9980000000" + (index + 11) },
        update: {}
      });
      await tx.child.upsert({
        where: { id: ID.children[index] },
        create: { id: ID.children[index], parentId: ID.parents[index],
          name: ["Тест: Азиз", "Тест: Малика", "Тест: Дониёр"][index],
          ageAtRegistration: 10 + index },
        update: {}
      });
      if (index !== 2) {
        const enrollment = await tx.studentEnrollment.findFirst({
          where: { childId: ID.children[index], groupId: group.id }
        });
        if (!enrollment) await tx.studentEnrollment.create({ data: {
          childId: ID.children[index], groupId: group.id, status: "ACTIVE",
          startDate: new Date(now - 7 * 86400000)
        } });
      }
    }
    await tx.lead.upsert({
      where: { id: ID.lead },
      create: { id: ID.lead, source: "sandbox", parentName: "Тестовый родитель 3",
        childName: "Тест: Дониёр", phone: "+998000000013", childAge: 12,
        parentId: ID.parents[2], childId: ID.children[2], branchId: branch.id,
        sportId: sport.id, groupId: group.id, selectedSessionId: ID.liveSession },
      update: { source: "sandbox", selectedSessionId: ID.liveSession }
    });
    await tx.trialBooking.upsert({
      where: { id: ID.booking },
      create: { id: ID.booking, leadId: ID.lead, sessionId: ID.liveSession,
        status: "CONFIRMED", expiresAt: new Date(now + 86400000), confirmedAt: new Date() },
      update: { status: "CONFIRMED", expiresAt: new Date(now + 86400000),
        confirmedAt: new Date(), reminderSentAt: null }
    });
    return { branchId: branch.id, coachId: coach.id, groupId: group.id };
  });
  await writeAdminAudit({ actorId: admin.sub, action: "SANDBOX_RESET",
    entityType: "Coach", entityId: ID.coach,
    after: { ...seed, synthetic: true } });
  return response({ ok: true, ...seed, username: ID.username, password,
    note: "Пароль показан один раз. Учебная тренировка начинается за 15 минут до текущего времени." });
}
