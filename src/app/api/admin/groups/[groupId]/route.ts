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

function dateKey(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { groupId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();

  const before = await prisma.trainingGroup.findUnique({
    where: { id: groupId },
    include: {
      branch: true,
      scheduleRules: {
        where: { status: LifecycleStatus.ACTIVE }
      }
    }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "GROUP_NOT_FOUND" },
      { status: 404 }
    );
  }

  const branchId =
    typeof body.branchId === "string" ? body.branchId : before.branchId;
  const sportId =
    typeof body.sportId === "string" ? body.sportId : before.sportId;
  const primaryCoachId =
    typeof body.primaryCoachId === "string"
      ? body.primaryCoachId
      : before.primaryCoachId;
  const internalName =
    typeof body.internalName === "string"
      ? body.internalName.trim().slice(0, 160)
      : before.internalName;

  const ageMin = Number(body.ageMin ?? before.ageMin);
  const ageMax = Number(body.ageMax ?? before.ageMax);
  const capacityRegular = Number(
    body.capacityRegular ?? before.capacityRegular
  );
  const capacityTrial =
    body.capacityTrial === null ||
    body.capacityTrial === undefined ||
    body.capacityTrial === ""
      ? null
      : Number(body.capacityTrial);

  const status = String(body.status ?? before.status) as LifecycleStatus;
  const enrollmentStatus = String(
    body.enrollmentStatus ?? before.enrollmentStatus
  ) as EnrollmentStatus;

  const level =
    body.level === undefined
      ? before.level
      : optionalString(body.level, 120);
  const notesInternal =
    body.notesInternal === undefined
      ? before.notesInternal
      : optionalString(body.notesInternal, 2000);
  const startDate =
    body.startDate === undefined ? before.startDate : parseDate(body.startDate);
  const endDate =
    body.endDate === undefined ? before.endDate : parseDate(body.endDate);

  if (
    !branchId ||
    !sportId ||
    !primaryCoachId ||
    !internalName ||
    level === undefined ||
    notesInternal === undefined ||
    startDate === undefined ||
    endDate === undefined
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_GROUP_FIELDS" },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(ageMin) ||
    !Number.isInteger(ageMax) ||
    ageMin < 3 ||
    ageMax > 19 ||
    ageMin > ageMax
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_AGE_RANGE" },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(capacityRegular) ||
    capacityRegular < 1 ||
    capacityRegular > 100 ||
    (capacityTrial !== null &&
      (!Number.isInteger(capacityTrial) ||
        capacityTrial < 0 ||
        capacityTrial > 30))
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CAPACITY" },
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

  let schedule:
    | Array<{
        weekday: Weekday;
        startMinutes: number;
        endMinutes: number;
      }>
    | null = null;

  if (Array.isArray(body.schedule)) {
    if (body.schedule.length === 0 || body.schedule.length > 14) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SCHEDULE" },
        { status: 400 }
      );
    }

    const parsed = (body.schedule as ScheduleInput[]).map((item) => ({
      weekday: item.weekday,
      startMinutes: parseTime(item.start),
      endMinutes: parseTime(item.end)
    }));

    if (
      parsed.some(
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

    const keys = parsed.map(
      (item) => `${item.weekday}:${item.startMinutes}`
    );

    if (new Set(keys).size !== keys.length) {
      return NextResponse.json(
        { ok: false, error: "DUPLICATE_SCHEDULE_RULE" },
        { status: 400 }
      );
    }

    schedule = parsed.map((item) => ({
      weekday: item.weekday,
      startMinutes: item.startMinutes as number,
      endMinutes: item.endMinutes as number
    }));
  }

  const now = new Date();
  const branchChanged = branchId !== before.branchId;
  const startChanged = dateKey(startDate) !== dateKey(before.startDate);
  const endChanged = dateKey(endDate) !== dateKey(before.endDate);
  const requiresRegeneration =
    Boolean(schedule) || branchChanged || startChanged || endChanged;

  if (requiresRegeneration) {
    const protectedFuture = await prisma.trainingSession.count({
      where: {
        groupId,
        startsAt: { gt: now },
        OR: [
          { trialBookings: { some: {} } },
          { attendances: { some: {} } }
        ]
      }
    });

    if (protectedFuture > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "FUTURE_SESSIONS_HAVE_BOOKINGS",
          bookedFuture: protectedFuture
        },
        { status: 409 }
      );
    }
  }

  const after = await prisma.$transaction(async (tx) => {
    await tx.branchSport.upsert({
      where: { branchId_sportId: { branchId, sportId } },
      update: { status: LifecycleStatus.ACTIVE },
      create: {
        branchId,
        sportId,
        status: LifecycleStatus.ACTIVE
      }
    });

    await tx.coachSport.upsert({
      where: {
        coachId_sportId: { coachId: primaryCoachId, sportId }
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
        coachId_branchId: { coachId: primaryCoachId, branchId }
      },
      update: { status: LifecycleStatus.ACTIVE },
      create: {
        coachId: primaryCoachId,
        branchId,
        status: LifecycleStatus.ACTIVE
      }
    });

    const updated = await tx.trainingGroup.update({
      where: { id: groupId },
      data: {
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

    if (requiresRegeneration) {
      await tx.trainingSession.deleteMany({
        where: {
          groupId,
          startsAt: { gt: now },
          trialBookings: { none: {} },
          attendances: { none: {} }
        }
      });
    }

    if (schedule) {
      await tx.groupScheduleRule.updateMany({
        where: {
          groupId,
          status: LifecycleStatus.ACTIVE
        },
        data: {
          status: LifecycleStatus.ARCHIVED,
          validTo: now
        }
      });

      await tx.groupScheduleRule.createMany({
        data: schedule.map((rule, index) => ({
          id: `RULE-${groupId}-${Date.now()}-${index}-${randomUUID()}`,
          groupId,
          weekday: rule.weekday,
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          validFrom: startDate ?? now,
          validTo: endDate,
          status: LifecycleStatus.ACTIVE
        }))
      });
    } else if (startChanged || endChanged) {
      await tx.groupScheduleRule.updateMany({
        where: {
          groupId,
          status: LifecycleStatus.ACTIVE
        },
        data: {
          validFrom: startDate ?? null,
          validTo: endDate
        }
      });
    }

    await tx.trainingSession.updateMany({
      where: {
        groupId,
        startsAt: { gt: now },
        trialBookings: { none: {} }
      },
      data: {
        coachId: primaryCoachId,
        regularCapacity: capacityRegular,
        trialCapacity: capacityTrial,
        trialBookingEnabled:
          status === LifecycleStatus.ACTIVE &&
          enrollmentStatus === EnrollmentStatus.OPEN &&
          capacityTrial !== null &&
          capacityTrial > 0
      }
    });

    return tx.trainingGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE }
        }
      }
    });
  });

  const shouldGenerate =
    status === LifecycleStatus.ACTIVE &&
    (requiresRegeneration || before.status !== LifecycleStatus.ACTIVE);

  if (shouldGenerate) {
    const from = dateKeyInTimeZone(now, branch.timezone);
    await generateTrainingSessions(prisma, {
      from,
      to: addDays(from, 84),
      branchId
    });
  }

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "TrainingGroup",
    entityId: groupId,
    before,
    after
  });

  return NextResponse.json({ ok: true, group: after });
}
