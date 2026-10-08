import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  EnrollmentStatus,
  LifecycleStatus,
  Weekday
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/timezone";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { generateTrainingSessions } from "@/server/sessions/generate-training-sessions";

type ScheduleInput = {
  weekday: Weekday;
  start: string;
  end: string;
};

function parseTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function parseDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const branchId = typeof body.branchId === "string" ? body.branchId : "";
  const sportId = typeof body.sportId === "string" ? body.sportId : "";
  const primaryCoachId =
    typeof body.primaryCoachId === "string" ? body.primaryCoachId : "";
  const internalName =
    typeof body.internalName === "string"
      ? body.internalName.trim().slice(0, 160)
      : "";

  const ageMin = Number(body.ageMin);
  const ageMax = Number(body.ageMax);
  const capacityRegular = Number(body.capacityRegular ?? 20);
  const capacityTrial =
    body.capacityTrial === "" ||
    body.capacityTrial === null ||
    body.capacityTrial === undefined
      ? null
      : Number(body.capacityTrial);

  const status = String(body.status ?? "DRAFT") as LifecycleStatus;
  const enrollmentStatus = String(
    body.enrollmentStatus ?? "PAUSED"
  ) as EnrollmentStatus;

  const level = optionalString(body.level, 120);
  const notesInternal = optionalString(body.notesInternal, 2000);
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (
    !branchId ||
    !sportId ||
    !primaryCoachId ||
    !internalName ||
    level === undefined ||
    notesInternal === undefined ||
    startDate === undefined ||
    endDate === undefined ||
    !Number.isInteger(ageMin) ||
    !Number.isInteger(ageMax) ||
    ageMin < 3 ||
    ageMax > 19 ||
    ageMin > ageMax ||
    !Number.isInteger(capacityRegular) ||
    capacityRegular < 1 ||
    capacityRegular > 100 ||
    (capacityTrial !== null &&
      (!Number.isInteger(capacityTrial) ||
        capacityTrial < 0 ||
        capacityTrial > 30))
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_GROUP_FIELDS" },
      { status: 400 }
    );
  }

  if (
    !Object.values(LifecycleStatus).includes(status) ||
    !Object.values(EnrollmentStatus).includes(enrollmentStatus)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  if (startDate && endDate && startDate > endDate) {
    return NextResponse.json(
      { ok: false, error: "INVALID_GROUP_DATE_RANGE" },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(body.schedule) ||
    body.schedule.length === 0 ||
    body.schedule.length > 14
  ) {
    return NextResponse.json(
      { ok: false, error: "SCHEDULE_REQUIRED" },
      { status: 400 }
    );
  }

  const schedule = (body.schedule as ScheduleInput[]).map((item) => ({
    weekday: item.weekday,
    startMinutes: parseTime(item.start),
    endMinutes: parseTime(item.end)
  }));

  if (
    schedule.some(
      (item) =>
        !Object.values(Weekday).includes(item.weekday) ||
        item.startMinutes === null ||
        item.endMinutes === null ||
        item.startMinutes >= item.endMinutes
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SCHEDULE" },
      { status: 400 }
    );
  }

  const scheduleKeys = schedule.map(
    (item) => `${item.weekday}:${item.startMinutes}`
  );
  if (new Set(scheduleKeys).size !== scheduleKeys.length) {
    return NextResponse.json(
      { ok: false, error: "DUPLICATE_SCHEDULE_RULE" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const [branch, sport, coach] = await Promise.all([
    prisma.branch.findFirst({
      where: {
        id: branchId,
        status: { not: LifecycleStatus.ARCHIVED }
      }
    }),
    prisma.sport.findFirst({
      where: {
        id: sportId,
        status: { not: LifecycleStatus.ARCHIVED }
      }
    }),
    prisma.coach.findFirst({
      where: {
        id: primaryCoachId,
        status: { not: LifecycleStatus.ARCHIVED }
      }
    })
  ]);

  if (!branch || !sport || !coach) {
    return NextResponse.json(
      { ok: false, error: "GROUP_RELATION_NOT_FOUND" },
      { status: 404 }
    );
  }

  const groupId = `GR-${randomUUID()}`;
  const now = new Date();

  const group = await prisma.$transaction(async (tx) => {
    await tx.branchSport.upsert({
      where: {
        branchId_sportId: { branchId, sportId }
      },
      update: { status: LifecycleStatus.ACTIVE },
      create: {
        branchId,
        sportId,
        status: LifecycleStatus.ACTIVE
      }
    });

    await tx.coachSport.upsert({
      where: {
        coachId_sportId: {
          coachId: primaryCoachId,
          sportId
        }
      },
      update: { status: LifecycleStatus.ACTIVE },
      create: {
        coachId: primaryCoachId,
        sportId,
        status: LifecycleStatus.ACTIVE
      }
    });

    await tx.coachBranch.upsert({
      where: {
        coachId_branchId: {
          coachId: primaryCoachId,
          branchId
        }
      },
      update: { status: LifecycleStatus.ACTIVE },
      create: {
        coachId: primaryCoachId,
        branchId,
        status: LifecycleStatus.ACTIVE
      }
    });

    const created = await tx.trainingGroup.create({
      data: {
        id: groupId,
        branchId,
        sportId,
        primaryCoachId,
        internalName,
        status,
        enrollmentStatus,
        ageMin,
        ageMax,
        capacityRegular,
        capacityTrial,
        level,
        notesInternal,
        startDate,
        endDate
      }
    });

    await tx.groupScheduleRule.createMany({
      data: schedule.map((rule, index) => ({
        id: `RULE-${groupId}-${index}-${randomUUID()}`,
        groupId,
        weekday: rule.weekday,
        startMinutes: rule.startMinutes as number,
        endMinutes: rule.endMinutes as number,
        validFrom: startDate ?? now,
        validTo: endDate,
        status: LifecycleStatus.ACTIVE
      }))
    });

    return created;
  });

  if (status === LifecycleStatus.ACTIVE) {
    const from = dateKeyInTimeZone(now, branch.timezone);
    await generateTrainingSessions(prisma, {
      from,
      to: addDays(from, 84),
      branchId
    });
  }

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE",
    entityType: "TrainingGroup",
    entityId: group.id,
    after: group
  });

  return NextResponse.json({ ok: true, group }, { status: 201 });
}
