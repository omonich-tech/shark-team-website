import {
  EnrollmentStatus,
  LifecycleStatus,
  SessionStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function getTrialOptions(
  age: number,
  sportSlug = "basketball",
  branchSlug = "school-117"
) {
  if (!Number.isInteger(age) || age < 6 || age > 17) {
    return {
      ok: false as const,
      error: "AGE_NOT_SUPPORTED" as const
    };
  }

  if (
    !/^[a-z0-9-]{2,80}$/.test(sportSlug) ||
    !/^[a-z0-9-]{2,120}$/.test(branchSlug)
  ) {
    return {
      ok: false as const,
      error: "INVALID_SELECTION" as const
    };
  }

  const prisma = getPrisma();
  const now = new Date();

  const group = await prisma.trainingGroup.findFirst({
    where: {
      status: LifecycleStatus.ACTIVE,
      enrollmentStatus: EnrollmentStatus.OPEN,
      ageMin: { lte: age },
      ageMax: { gte: age },
      branch: {
        slug: branchSlug,
        status: LifecycleStatus.ACTIVE
      },
      sport: {
        slug: sportSlug,
        status: LifecycleStatus.ACTIVE
      }
    },
    include: {
      branch: true,
      sport: true,
      primaryCoach: true
    },
    orderBy: [{ ageMin: "asc" }, { createdAt: "asc" }]
  });

  if (!group) {
    return {
      ok: false as const,
      error: "NO_MATCHING_GROUP" as const
    };
  }

  if (group.capacityTrial === null || group.capacityTrial <= 0) {
    return {
      ok: true as const,
      bookingAvailable: false as const,
      reason: "TRIAL_CAPACITY_NOT_CONFIGURED" as const,
      group: {
        id: group.id,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        branchSlug: group.branch.slug,
        branchNameRu: group.branch.publicNameRu,
        branchNameUz: group.branch.publicNameUz,
        sportSlug: group.sport.slug,
        sportNameRu: group.sport.nameRu,
        sportNameUz: group.sport.nameUz,
        coachName: [group.primaryCoach.firstName, group.primaryCoach.lastName]
          .filter(Boolean)
          .join(" ")
      },
      sessions: []
    };
  }

  await prisma.trialBooking.updateMany({
    where: {
      status: TrialBookingStatus.HOLD,
      expiresAt: { lte: now }
    },
    data: {
      status: TrialBookingStatus.EXPIRED
    }
  });

  const sessions = await prisma.trainingSession.findMany({
    where: {
      groupId: group.id,
      status: SessionStatus.SCHEDULED,
      startsAt: { gt: now },
      trialBookingEnabled: true,
      trialCapacity: { gt: 0 }
    },
    include: {
      trialBookings: {
        where: {
          OR: [
            { status: TrialBookingStatus.CONFIRMED },
            { status: TrialBookingStatus.PAYMENT_PENDING },
            {
              status: TrialBookingStatus.HOLD,
              expiresAt: { gt: now }
            }
          ]
        },
        select: { id: true }
      }
    },
    orderBy: { startsAt: "asc" },
    take: 24
  });

  const availableSessions = sessions
    .filter(
      (session) =>
        session.trialCapacity !== null &&
        session.trialBookings.length < session.trialCapacity
    )
    .slice(0, 12);

  return {
    ok: true as const,
    bookingAvailable: availableSessions.length > 0,
    reason:
      availableSessions.length > 0
        ? null
        : ("NO_AVAILABLE_SESSIONS" as const),
    group: {
      id: group.id,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      branchSlug: group.branch.slug,
      branchNameRu: group.branch.publicNameRu,
      branchNameUz: group.branch.publicNameUz,
      sportSlug: group.sport.slug,
      sportNameRu: group.sport.nameRu,
      sportNameUz: group.sport.nameUz,
      coachName: [group.primaryCoach.firstName, group.primaryCoach.lastName]
        .filter(Boolean)
        .join(" ")
    },
    sessions: availableSessions.map((session) => ({
      id: session.id,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      remainingTrialSpots:
        (session.trialCapacity ?? 0) - session.trialBookings.length
    }))
  };
}
