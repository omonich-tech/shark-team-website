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

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
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

  const status = String(body.status ?? before.status) as LifecycleStatus;
  const enrollmentStatus = String(
    body.enrollmentStatus ?? before.enrollmentStatus
  ) as EnrollmentStatus;

  if (
    !Object.values(LifecycleStatus).includes(status) ||
    !Object.values(EnrollmentStatus).includes(enrollmentStatus)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
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

  if (schedule) {
    const bookedFuture = await prisma.trainingSession.count({
      where: {
        groupId,
        startsAt: { gt: now },
        trialBookings: { some: {} }
      }
    });

    if (bookedFuture > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "FUTURE_SESSIONS_HAVE_BOOKINGS",
          bookedFuture
        },
        { status: 409 }
      );
    }
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.trainingGroup.update({
      where: { id: groupId },
      data: {
        status,
        enrollmentStatus,
        ageMin,
        ageMax,
        capacityRegular,
        capacityTrial
      }
    });

    if (schedule) {
      await tx.trainingSession.deleteMany({
        where: {
          groupId,
          startsAt: { gt: now },
          trialBookings: { none: {} },
          attendances: { none: {} }
        }
      });

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
          id: `RULE-${groupId}-${Date.now()}-${index}`,
          groupId,
          weekday: rule.weekday,
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          validFrom: now,
          status: LifecycleStatus.ACTIVE
        }))
      });
    } else {
      await tx.trainingSession.updateMany({
        where: {
          groupId,
          startsAt: { gt: now },
          trialBookings: { none: {} }
        },
        data: {
          regularCapacity: capacityRegular,
          trialCapacity: capacityTrial,
          trialBookingEnabled:
            enrollmentStatus === EnrollmentStatus.OPEN &&
            capacityTrial !== null &&
            capacityTrial > 0
        }
      });
    }

    return tx.trainingGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: {
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE }
        }
      }
    });
  });

  if (schedule) {
    const from = dateKeyInTimeZone(now, "Asia/Tashkent");
    await generateTrainingSessions(prisma, {
      from,
      to: addDays(from, 84),
      branchId: before.branchId
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
