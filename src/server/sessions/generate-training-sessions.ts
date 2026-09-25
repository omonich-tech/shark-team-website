import {
  EnrollmentStatus,
  LifecycleStatus,
  PrismaClient,
  Weekday
} from "@/generated/prisma/client";

const WEEKDAY_BY_UTC_DAY: Record<number, Weekday> = {
  0: Weekday.SUNDAY,
  1: Weekday.MONDAY,
  2: Weekday.TUESDAY,
  3: Weekday.WEDNESDAY,
  4: Weekday.THURSDAY,
  5: Weekday.FRIDAY,
  6: Weekday.SATURDAY
};

type GenerateTrainingSessionsOptions = {
  from: string;
  to: string;
  branchId?: string;
};

type GenerateTrainingSessionsResult = {
  considered: number;
  created: number;
};

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${value}".`);
  }

  return date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isDateInRange(
  current: string,
  validFrom: Date | null,
  validTo: Date | null
) {
  if (validFrom && current < toDateOnly(validFrom)) {
    return false;
  }

  if (validTo && current > toDateOnly(validTo)) {
    return false;
  }

  return true;
}

function partsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function localDateTimeToUtc(
  calendarDate: Date,
  minutesFromMidnight: number,
  timeZone: string
) {
  const year = calendarDate.getUTCFullYear();
  const month = calendarDate.getUTCMonth() + 1;
  const day = calendarDate.getUTCDate();
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;

  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = partsInTimeZone(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );

    const delta = targetAsUtc - observedAsUtc;

    if (delta === 0) {
      break;
    }

    guess += delta;
  }

  return new Date(guess);
}

export async function generateTrainingSessions(
  prisma: PrismaClient,
  options: GenerateTrainingSessionsOptions
): Promise<GenerateTrainingSessionsResult> {
  const from = parseDateKey(options.from);
  const to = parseDateKey(options.to);

  if (from > to) {
    throw new Error("Session generation range is invalid: from is after to.");
  }

  const groups = await prisma.trainingGroup.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      ...(options.branchId ? { branchId: options.branchId } : {})
    },
    include: {
      branch: true,
      scheduleRules: {
        where: {
          status: LifecycleStatus.ACTIVE
        }
      }
    }
  });

  const pendingSessions = [];

  for (const group of groups) {
    for (let day = from; day <= to; day = addUtcDays(day, 1)) {
      const currentDateKey = dateKey(day);

      if (!isDateInRange(currentDateKey, group.startDate, group.endDate)) {
        continue;
      }

      const weekday = WEEKDAY_BY_UTC_DAY[day.getUTCDay()];

      for (const rule of group.scheduleRules) {
        if (rule.weekday !== weekday) {
          continue;
        }

        if (!isDateInRange(currentDateKey, rule.validFrom, rule.validTo)) {
          continue;
        }

        const startsAt = localDateTimeToUtc(
          day,
          rule.startMinutes,
          group.branch.timezone
        );
        const endsAt = localDateTimeToUtc(
          day,
          rule.endMinutes,
          group.branch.timezone
        );

        pendingSessions.push({
          groupId: group.id,
          coachId: group.primaryCoachId,
          scheduleRuleId: rule.id,
          sourceDate: new Date(`${currentDateKey}T00:00:00.000Z`),
          startsAt,
          endsAt,
          regularCapacity: group.capacityRegular,
          trialCapacity: group.capacityTrial,
          trialBookingEnabled:
            group.enrollmentStatus === EnrollmentStatus.OPEN &&
            group.capacityTrial !== null &&
            group.capacityTrial > 0
        });
      }
    }
  }

  if (pendingSessions.length === 0) {
    return {
      considered: 0,
      created: 0
    };
  }

  const created = await prisma.trainingSession.createMany({
    data: pendingSessions,
    skipDuplicates: true
  });

  return {
    considered: pendingSessions.length,
    created: created.count
  };
}
